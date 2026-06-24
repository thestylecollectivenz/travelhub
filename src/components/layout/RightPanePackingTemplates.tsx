import * as React from 'react';
import { useSpContext } from '../../context/SpContext';
import { PackingService } from '../../services/PackingService';
import { PACKING_DRAG_MIME } from '../../utils/packingTemplateDrag';
import styles from './RightPaneInsights.module.css';

export const RightPanePackingTemplates: React.FC = () => {
  const spContext = useSpContext();
  const service = React.useMemo(() => new PackingService(spContext), [spContext]);
  const [templates, setTemplates] = React.useState<
    Array<{ id: string; templateName: string; items: Array<{ id: string; category: string; itemName: string; quantity: number }> }>
  >([]);
  const [selectedId, setSelectedId] = React.useState('');

  React.useEffect(() => {
    service.getTemplates().then((rows) => {
      setTemplates(rows);
      if (rows[0]) setSelectedId(rows[0].id);
    }).catch(console.error);
  }, [service]);

  const selected = templates.find((t) => t.id === selectedId);

  const addItemToTrip = (itemName: string, category: string, quantity: number): void => {
    window.dispatchEvent(
      new CustomEvent('packing-template-add', {
        detail: { itemName, category, quantity: quantity || 1 }
      })
    );
  };

  return (
    <section className={styles.root} aria-label="Packing templates">
      <h2 className={styles.heading}>Packing templates</h2>
      <p className={styles.muted}>Drag items onto the packing list or click Add.</p>
      <select className={styles.select} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        <option value="">Select template…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.templateName} ({t.items.length})
          </option>
        ))}
      </select>
      {selected ? (
        <ul className={styles.list}>
          {selected.items.map((item) => (
            <li
              key={item.id}
              className={styles.templateItem}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  PACKING_DRAG_MIME,
                  JSON.stringify({ itemName: item.itemName, category: item.category, quantity: item.quantity || 1 })
                );
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <span>
                {item.itemName}
                <span className={styles.muted}> · {item.category}</span>
              </span>
              <button
                type="button"
                className={styles.addBtn}
                onClick={() => addItemToTrip(item.itemName, item.category, item.quantity)}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No template selected.</p>
      )}
    </section>
  );
};

export { PACKING_DRAG_MIME } from '../../utils/packingTemplateDrag';
