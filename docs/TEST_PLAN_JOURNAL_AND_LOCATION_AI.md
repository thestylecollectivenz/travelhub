# Test plan — Journal/photos (v1.0.11.12) and Location info AI (v1.0.11.11)

Use a trip with multiple days, several journal entries on at least one day, mixed portrait/landscape photos, and itinerary items with location cards. Confirm the app version in the UI shows **1.0.11.12** after deployment.

---

## Journal and photos (v1.0.11.12)

### Multiple entries per day
- [ ] Open **Journal** tab; confirm two or more entries appear under the same day heading.
- [ ] Create a second entry on an existing day via **New journal entry**; both entries remain visible and ordered.

### Photo association — journal composer
- [ ] Start **New journal entry**, attach 2+ photos before save.
- [ ] After save, photos appear on that entry only (not duplicated on sibling entries the same day).

### Photo association — existing entry
- [ ] On an existing entry card, use **Add photos** and upload an image.
- [ ] Photos appear on that entry’s board layout beneath the text.

### Photo association — Photos tab upload
- [ ] **Add photos** → pick a **Day** and a **Journal entry**.
- [ ] Upload; photo shows in album with correct entry label.
- [ ] Upload with **Album only**; photo shows as unassigned until linked.

### Right panel association
- [ ] On **Journal** or **Photos** tab, click a photo.
- [ ] Right panel shows preview, day selector, entry selector.
- [ ] Change day/entry → **Save association**; photo moves in journal view and album label updates.
- [ ] **Delete photo** from right panel removes it everywhere.

### Drag and drop — photos
- [ ] Drag a photo (⋮⋮ handle) onto a different journal entry card; it re-associates.
- [ ] Drop a file onto an entry card; it uploads to that entry.

### Drag and drop — journal entries
- [ ] Drag entry via ⋮⋮ handle to reorder within a day.
- [ ] Drag entry onto another day section (drop on day area); entry and its photos move to that day.
- [ ] Use entry menu **Move to day** → **Apply move** as an alternative.

### Delete photos
- [ ] Delete from entry card footer, album footer, or right panel; photo removed from SharePoint list and UI.

### Masonry / board layout
- [ ] Photos tab and journal entry photos use varied tile sizes (not uniform square crops).
- [ ] Portrait and landscape images keep natural proportions without awkward heavy cropping.

### Export journal / PDF
- [ ] **Export journal** → open preview.
- [ ] Window title is `{Trip name} — Journal` (not `about:blank`).
- [ ] **Print / Save PDF** opens the browser print dialog.
- [ ] Each entry shows only its linked photos; orphan album photos appear in a separate album section per day (not on every entry).

---

## Location info AI (v1.0.11.11)

### Trip-open backfill
- [ ] Open a trip with itinerary items that have location cards but **empty** overview/tips/highlights.
- [ ] After load (~few seconds), empty cards fill sequentially without blocking the UI.
- [ ] Cards that already have user content are **not** overwritten.

### Manual AI generation button
- [ ] Edit an itinerary item → Location info section.
- [ ] Empty card: button reads **Generate overview, tips & highlights**.
- [ ] Partially filled card: button reads **Add more AI suggestions**.

### Ask AI Q&A
- [ ] Open **Ask AI** on a location card; submit a question.
- [ ] Answer appears in the thread and persists after refresh.
- [ ] Follow-up questions append to the same thread.

### Safe merge / user edits
- [ ] Manually edit overview or practical tips; run AI again.
- [ ] Your edited overview/tips are preserved (`userEdited*` flags).
- [ ] New AI highlights merge **additively**; checked highlights stay checked.
- [ ] Remove/suppress a highlight; re-run AI — suppressed item does not return.

### Practical tips in generation
- [ ] Generate on a fresh card; **Practical tips** section is populated (not only overview/highlights).

---

## Regression smoke
- [ ] Shared trip view: journal and photos visible; no private financial data.
- [ ] Itinerary drag-and-drop still works.
- [ ] SharePoint layout (left nav, comments band) unchanged after deploy.
