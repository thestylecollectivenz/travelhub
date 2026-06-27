import * as React from 'react';
import { usePlanView } from '../../context/PlanViewContext';
import { useTripWorkspace } from '../../context/TripWorkspaceContext';
import { useSpContext } from '../../context/SpContext';
import { PackingItem, PackingService } from '../../services/PackingService';
import { loadTripTravellers } from '../../utils/tripTravellers';
import { confirmUserAction } from '../../utils/confirmAction';
import { useTripRole } from '../../context/TripRoleContext';
import { canEditOwnedRecord } from '../../utils/canEditOwnedRecord';
import { PACKING_DRAG_MIME, parsePackingTemplateDrag } from '../../utils/packingTemplateDrag';
import styles from './PackingListView.module.css';

const CATEGORIES = ['Clothing', 'Shoes', 'Accessories', 'Toiletries', 'Electronics', 'Documents', 'Medications', 'Other'];

export const PackingListView: React.FC = () => {
  const spContext = useSpContext();
  const { trip } = useTripWorkspace();
  const planView = usePlanView();
  const activeCategory = planView?.packingCategory ?? 'Other';
  const activeTraveller = planView?.packingTraveller ?? null;
  const travellers = React.useMemo(() => (trip?.id ? loadTripTravellers(trip.id) : ['Traveller 1']), [trip?.id]);
  const service = React.useMemo(() => new PackingService(spContext), [spContext]);
  const { role } = useTripRole();
  const canEditItem = React.useCallback(
    (item: PackingItem) => canEditOwnedRecord(spContext, item.ownerEmail, role),
    [spContext, role]
  );
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

  const addTemplateItem = React.useCallback(
    (itemName: string, category: string, quantity: number): void => {
      if (!trip?.id || !itemName.trim()) return;
      const traveller = activeTraveller || travellers[0] || 'Traveller 1';
      const cat = CATEGORIES.indexOf(category) >= 0 ? category : 'Other';
      service
        .create({
          tripId: trip.id,
          category: activeCategory === '__all__' ? cat : activeCategory,
          traveller,
          itemName: itemName.trim(),
          quantity: Math.max(1, quantity || 1),
          isPacked: false,
          isTemplate: false,
          templateId: ''
        })
        .then(refresh)
        .catch(console.error);
    },
    [service, trip?.id, activeTraveller, travellers, activeCategory, refresh]
  );

  React.useEffect(() => {
    const onTemplateAdd = (event: Event): void => {
      const detail = (event as CustomEvent<{ itemName?: string; category?: string; quantity?: number }>).detail;
      if (!detail?.itemName) return;
      addTemplateItem(detail.itemName, detail.category || 'Other', detail.quantity || 1);
    };
    window.addEventListener('packing-template-add', onTemplateAdd);
    return () => window.removeEventListener('packing-template-add', onTemplateAdd);
  }, [addTemplateItem]);

  const [dropActive, setDropActive] = React.useState(false);

  const handleTemplateDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>): void => {
      event.preventDefault();
      setDropActive(false);
      const payload = parsePackingTemplateDrag(event.dataTransfer.getData(PACKING_DRAG_MIME));
      if (!payload) return;
      addTemplateItem(payload.itemName, payload.category, payload.quantity);
    },
    [addTemplateItem]
  );

  React.useEffect(() => {
    const openTemplates = (): void => {
      service.getTemplates().then(setTemplates).catch(console.error);
      setTemplatesOpen(true);
    };
    window.addEventListener('open-packing-templates', openTemplates);
    return () => window.removeEventListener('open-packing-templates', openTemplates);
  }, [service]);

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
    <section
      className={`${styles.root} ${dropActive ? styles.dropActive : ''}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.indexOf(PACKING_DRAG_MIME) >= 0) {
          e.preventDefault();
          setDropActive(true);
        }
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={handleTemplateDrop}
    >
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
                void (async () => {
                  if (!trip?.id) return;
                  const traveller = activeTraveller || travellers[0] || 'Traveller 1';
                  const travellerItems = items.filter((i) => (i.traveller || travellers[0]) === traveller);
                  const existingKeys = new Set(
                    travellerItems.map((i) => `${i.category}|${i.itemName.trim().toLowerCase()}`)
                  );
                  const toCreate = tpl.items.filter(
                    (item) => !existingKeys.has(`${item.category}|${(item.itemName || '').trim().toLowerCase()}`)
                  );

                  let replaceAll = false;
                  if (travellerItems.length > 0) {
                    replaceAll = await confirmUserAction(
                      `Load template “${tpl.templateName}”?`,
                      'Confirm to replace all existing packing items for this traveller with the template. Cancel to add only items that are not already on the list.'
                    );
                  }

                  planView?.setPackingCategory('__all__');

                  if (replaceAll) {
                    await Promise.all(travellerItems.map((i) => service.delete(i.id)));
                    await service.bulkCreate(
                      tpl.items.map((item) => ({
                        tripId: trip.id,
                        category: item.category,
                        itemName: item.itemName,
                        quantity: item.quantity,
                        traveller,
                        isPacked: false,
                        isTemplate: false,
                        templateId: ''
                      }))
                    );
                  } else {
                    if (!toCreate.length) return;
                    await service.bulkCreate(
                      toCreate.map((item) => ({
                        tripId: trip.id,
                        category: item.category,
                        itemName: item.itemName,
                        quantity: item.quantity,
                        traveller,
                        isPacked: false,
                        isTemplate: false,
                        templateId: ''
                      }))
                    );
                  }
                  refresh();
                })().catch(console.error);
              }}>Load</button>
            </div>
          ))}
        </div>
      ) : null}

      {categoryRows.length === 0 ? (
        <p className={styles.muted}>No items in this category yet.</p>
      ) : (
        categoryRows.map((item) => {
          const editable = canEditItem(item);
          return (
          <div key={item.id} className={styles.item}>
            <input
              type="checkbox"
              checked={item.isPacked}
              disabled={!editable}
              onChange={(e) => service.update(item.id, { isPacked: e.target.checked }).then(refresh).catch(console.error)}
            />
            <span className={styles.itemName}>{item.itemName}</span>
            <select
              className={styles.select}
              aria-label="Category"
              value={CATEGORIES.indexOf(item.category) >= 0 ? item.category : 'Other'}
              disabled={!editable}
              onChange={(e) => {
                void service.update(item.id, { category: e.target.value }).then(refresh).catch(console.error);
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className={styles.qtyInput}
              type="number"
              min={1}
              value={item.quantity}
              disabled={!editable}
              onChange={(e) => {
                const q = Math.max(1, Number(e.target.value) || 1);
                void service.update(item.id, { quantity: q }).then(refresh).catch(console.error);
              }}
            />
            <input
              className={styles.noteInput}
              type="text"
              placeholder="Note"
              value={noteDrafts[item.id] ?? ''}
              disabled={!editable}
              onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
              onBlur={() => {
                if (!editable) return;
                const notes = (noteDrafts[item.id] ?? '').trim();
                void service.update(item.id, { itemNotes: notes || undefined }).then(refresh).catch(console.error);
              }}
            />
            {editable ? (
            <button
              className={styles.deleteBtn}
              type="button"
              aria-label="Delete packing item"
              onClick={() => {
                void (async () => {
                  if (!(await confirmUserAction('Delete this packing item?'))) return;
                  service.delete(item.id).then(refresh).catch(console.error);
                })();
              }}
            >
              Delete
            </button>
            ) : null}
          </div>
        );
        })
      )}
    </section>
  );
};
