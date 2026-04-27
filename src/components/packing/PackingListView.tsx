import * as React from 'react';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { PackingItem, PackingService } from '../../services/PackingService';
import styles from './PackingListView.module.css';

const CATEGORIES = ['Clothing', 'Toiletries', 'Electronics', 'Documents', 'Medications', 'Other'];

export const PackingListView: React.FC = () => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const service = React.useMemo(() => new PackingService(spContext), [spContext]);
  const [items, setItems] = React.useState<PackingItem[]>([]);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('Other');
  const [qty, setQty] = React.useState(1);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<Array<{ id: string; templateName: string; description: string; items: PackingItem[] }>>([]);
  const [templateName, setTemplateName] = React.useState('');

  const refresh = React.useCallback(() => {
    if (!trip?.id) return;
    service.getForTrip(trip.id).then(setItems).catch(console.error);
  }, [service, trip?.id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, PackingItem[]>();
    for (const c of CATEGORIES) map.set(c, []);
    for (const item of items) {
      const c = CATEGORIES.indexOf(item.category) >= 0 ? item.category : 'Other';
      map.set(c, [...(map.get(c) ?? []), item]);
    }
    return CATEGORIES.map((c) => ({ category: c, rows: map.get(c) ?? [] }));
  }, [items]);

  const packedCount = items.filter((i) => i.isPacked).length;

  return (
    <section className={styles.root}>
      <div className={styles.row}>
        <h2 style={{ margin: 0 }}>Packing</h2>
        <span className={styles.muted}>{packedCount} of {items.length} items packed</span>
        <button className={styles.button} type="button" onClick={() => {
          Promise.all(items.filter((i) => i.isPacked).map((i) => service.update(i.id, { isPacked: false }))).then(refresh).catch(console.error);
        }}>Clear all packed</button>
      </div>

      <div className={styles.row}>
        <input className={styles.input} placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
        <button className={styles.button} type="button" onClick={() => {
          if (!trip?.id || !name.trim()) return;
          service.create({ tripId: trip.id, category, itemName: name.trim(), quantity: qty, isPacked: false, isTemplate: false, templateId: '' })
            .then(() => {
              setName('');
              setQty(1);
              refresh();
            })
            .catch(console.error);
        }}>Add item</button>
      </div>

      <div className={styles.row}>
        <button className={styles.button} type="button" onClick={() => {
          if (!templatesOpen) service.getTemplates().then(setTemplates).catch(console.error);
          setTemplatesOpen((v) => !v);
        }}>{templatesOpen ? 'Hide templates' : 'Load template'}</button>
        <input className={styles.input} placeholder="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
        <button className={styles.button} type="button" onClick={() => {
          if (!templateName.trim() || !items.length) return;
          service.createTemplate(templateName.trim(), `Saved from trip ${trip?.title || ''}`)
            .then((tpl) =>
              service.bulkCreate(items.map((item) => ({
                tripId: '',
                category: item.category,
                itemName: item.itemName,
                quantity: item.quantity,
                isPacked: false,
                isTemplate: true,
                templateId: tpl.id
              })))
            )
            .then(() => setTemplateName(''))
            .catch(console.error);
        }}>Save as template</button>
      </div>
      {templatesOpen ? (
        <div className={styles.group}>
          {templates.map((tpl) => (
            <div key={tpl.id} className={styles.row}>
              <strong>{tpl.templateName}</strong>
              <span className={styles.muted}>{tpl.items.length} items</span>
              <button className={styles.button} type="button" onClick={() => {
                if (!trip?.id) return;
                service.bulkCreate(tpl.items.map((item) => ({
                  tripId: trip.id,
                  category: item.category,
                  itemName: item.itemName,
                  quantity: item.quantity,
                  isPacked: false,
                  isTemplate: false,
                  templateId: ''
                }))).then(refresh).catch(console.error);
              }}>Load</button>
            </div>
          ))}
        </div>
      ) : null}

      {grouped.map((g) => (
        <div key={g.category} className={styles.group}>
          <div className={styles.groupHead} onClick={() => setCollapsed((prev) => ({ ...prev, [g.category]: !prev[g.category] }))}>
            <strong>{g.category}</strong>
            <span className={styles.muted}>{g.rows.length} items</span>
          </div>
          {collapsed[g.category] ? null : g.rows.map((item) => (
            <div key={item.id} className={styles.item}>
              <input type="checkbox" checked={item.isPacked} onChange={(e) => service.update(item.id, { isPacked: e.target.checked }).then(refresh).catch(console.error)} />
              <span>{item.itemName}</span>
              <span className={styles.muted}>x{item.quantity}</span>
              <button className={styles.button} type="button" onClick={() => service.delete(item.id).then(refresh).catch(console.error)}>Delete</button>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
};
