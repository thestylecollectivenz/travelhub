import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { PackingItem, PackingService } from '../../services/PackingService';
import { loadTripTravellers } from '../../utils/tripTravellers';
import { confirmUserAction } from '../../utils/confirmAction';
import styles from './PackingListView.module.css';

const CATEGORIES = ['Clothing', 'Toiletries', 'Electronics', 'Documents', 'Medications', 'Other'];

export const PackingListView: React.FC = () => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const planView = usePlanView();
  const activeCategory = planView?.packingCategory ?? 'Other';
  const activeTraveller = planView?.packingTraveller ?? null;
  const travellers = React.useMemo(() => (trip?.id ? loadTripTravellers(trip.id) : ['Traveller 1']), [trip?.id]);
  const service = React.useMemo(() => new PackingService(spContext), [spContext]);
  const [items, setItems] = React.useState<PackingItem[]>([]);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('Other');
  const [qty, setQty] = React.useState(1);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<Array<{ id: string; templateName: string; description: string; items: PackingItem[] }>>([]);
  const [templateName, setTemplateName] = React.useState('');
  const [noteDrafts, setNoteDrafts] = React.useState<Record<string, string>>({});

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
  const filteredItems = React.useMemo(() => {
    let rows = items;
    if (activeTraveller) {
      rows = rows.filter((i) => (i.traveller || travellers[0] || '').trim() === activeTraveller);
    }
    return rows;
  }, [items, activeTraveller, travellers]);

  const categoryRows = React.useMemo(() => {
    if (activeCategory === '__all__') return filteredItems;
    return filteredItems.filter(
      (i) => (CATEGORIES.indexOf(i.category) >= 0 ? i.category : 'Other') === activeCategory
    );
  }, [filteredItems, activeCategory]);

  React.useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of categoryRows) {
      next[item.id] = item.itemNotes ?? '';
    }
    setNoteDrafts(next);
  }, [categoryRows]);

  return (
    <section className={styles.root}>
      <div className={styles.row}>
        <h2 className={styles.heading}>
          Packing — {activeTraveller ? activeTraveller : 'All travellers'}
          {activeCategory === '__all__' ? ' · All items' : ` · ${activeCategory}`}
        </h2>
        <span className={styles.muted}>
          {categoryRows.filter((i) => i.isPacked).length} of {categoryRows.length} items packed
        </span>
        <button className={styles.button} type="button" onClick={() => {
          Promise.all(items.filter((i) => i.isPacked).map((i) => service.update(i.id, { isPacked: false }))).then(refresh).catch(console.error);
        }}>Clear all packed</button>
      </div>

      <div className={styles.row}>
        <input className={styles.input} placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={styles.select} value={activeCategory} onChange={(e) => planView?.setPackingCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className={styles.input} type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
        <button className={styles.button} type="button" onClick={() => {
          if (!trip?.id || !name.trim()) return;
          service.create({
            tripId: trip.id,
            category: activeCategory === '__all__' ? 'Other' : activeCategory,
            traveller: activeTraveller || travellers[0] || 'Traveller 1',
            itemName: name.trim(),
            quantity: qty,
            isPacked: false,
            isTemplate: false,
            templateId: ''
          })
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

      {categoryRows.length === 0 ? (
        <p className={styles.muted}>No items in this category yet.</p>
      ) : (
        categoryRows.map((item) => (
          <div key={item.id} className={styles.item}>
            <input
              type="checkbox"
              checked={item.isPacked}
              onChange={(e) => service.update(item.id, { isPacked: e.target.checked }).then(refresh).catch(console.error)}
            />
            <div className={styles.itemMain}>
              <span>{item.itemName}</span>
              <span className={styles.muted}>×{item.quantity}</span>
              <textarea
                className={styles.noteInput}
                rows={2}
                placeholder="Note (optional)"
                value={noteDrafts[item.id] ?? ''}
                onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                onBlur={() => {
                  const notes = (noteDrafts[item.id] ?? '').trim();
                  void service.update(item.id, { itemNotes: notes || undefined }).then(refresh).catch(console.error);
                }}
              />
            </div>
            <button
              className={styles.button}
              type="button"
              onClick={() => {
                if (!confirmUserAction('Delete this packing item?')) return;
                service.delete(item.id).then(refresh).catch(console.error);
              }}
            >
              Delete
            </button>
          </div>
        ))
      )}
    </section>
  );
};
