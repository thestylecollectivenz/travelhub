import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { PackingService } from '../../services/PackingService';
import { confirmUserAction } from '../../utils/confirmAction';
import styles from '../packing/PackingListView.module.css';

const CATEGORIES = ['Clothing', 'Shoes', 'Accessories', 'Toiletries', 'Electronics', 'Documents', 'Medications', 'Other'];

export const PackingTemplatesManager: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const spContext = useSpContext();
  const service = React.useMemo(() => new PackingService(spContext), [spContext]);
  const [templates, setTemplates] = React.useState<Array<{ id: string; templateName: string; items: Array<{ id: string; category: string; itemName: string; quantity: number }> }>>([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [templateName, setTemplateName] = React.useState('');
  const [newItemName, setNewItemName] = React.useState('');
  const [newItemCategory, setNewItemCategory] = React.useState('Other');

  const refresh = React.useCallback(() => {
    service.getTemplates().then((rows) => {
      setTemplates(rows);
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    }).catch(console.error);
  }, [service, selectedId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = templates.find((t) => t.id === selectedId);

  return (
    <div>
      <div className={styles.row}>
        <h3 className={styles.heading}>Packing templates</h3>
        {onClose ? (
          <button className={styles.button} type="button" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
      <p className={styles.muted}>Create and edit template contents. Use the Packing tab to load a template onto a trip.</p>
      <div className={styles.row}>
        <select className={styles.select} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">Select template…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.templateName} ({t.items.length})
            </option>
          ))}
        </select>
        <input className={styles.input} placeholder="New template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
        <button
          className={styles.button}
          type="button"
          onClick={() => {
            if (!templateName.trim()) return;
            service
              .createTemplate(templateName.trim(), '')
              .then(() => {
                setTemplateName('');
                refresh();
              })
              .catch(console.error);
          }}
        >
          Add template
        </button>
        {selected ? (
          <button
            className={styles.button}
            type="button"
            onClick={() => {
              void (async () => {
                if (!(await confirmUserAction(`Delete template “${selected.templateName}” and all its items?`))) return;
                service.deleteTemplate(selected.id).then(() => {
                  setSelectedId('');
                  refresh();
                }).catch(console.error);
              })();
            }}
          >
            Delete template
          </button>
        ) : null}
      </div>
      {selected ? (
        <>
          <div className={styles.row}>
            <input className={styles.input} placeholder="Item name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
            <select className={styles.select} value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              className={styles.button}
              type="button"
              onClick={() => {
                if (!newItemName.trim()) return;
                service
                  .create({
                    tripId: '',
                    category: newItemCategory,
                    itemName: newItemName.trim(),
                    quantity: 1,
                    traveller: 'Traveller 1',
                    isPacked: false,
                    isTemplate: true,
                    templateId: selected.id
                  })
                  .then(() => {
                    setNewItemName('');
                    refresh();
                  })
                  .catch(console.error);
              }}
            >
              Add to template
            </button>
          </div>
          {selected.items.length === 0 ? (
            <p className={styles.muted}>No items in this template.</p>
          ) : (
            selected.items.map((item) => (
              <div key={item.id} className={styles.item}>
                <span className={styles.itemName}>
                  {item.category}: {item.itemName} ×{item.quantity}
                </span>
                <button
                  className={styles.deleteBtn}
                  type="button"
                  onClick={() => {
                    void (async () => {
                      if (!(await confirmUserAction('Remove this item from the template?'))) return;
                      service.delete(item.id).then(refresh).catch(console.error);
                    })();
                  }}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </>
      ) : null}
    </div>
  );
};
