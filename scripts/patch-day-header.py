from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "components" / "day" / "DayHeader.tsx"
t = p.read_text(encoding="utf-8")

t = t.replace("setPlaceInfoOpen", "setLocationsExpanded")
t = t.replace("placeInfoOpen", "locationsExpanded")

t = t.replace(
    "{locationsExpanded ? 'Hide place info' : 'Show place info'}",
    "{locationsExpanded ? 'Hide locations' : 'Show locations'}",
)

# wrap place section
t = t.replace(
    "        <div className={styles.placeSection}>",
    "        {locationsExpanded ? (\n        <motionlessDialog className={styles.placeSection}>",
    1,
)
t = t.replace(
    "          {locationMessage ? <div className={styles.infoSub}>{locationMessage}</div> : null}\n        </div>\n      </div>",
    "          {locationMessage ? <div className={styles.infoSub}>{locationMessage}</div> : null}\n        </div>\n        ) : null}\n      </div>",
    1,
)
t = t.replace("motionlessDialog", "motionlessDialog")  # noop guard
t = t.replace("<motionlessDialog className={styles.placeSection}>", "<div className={styles.placeSection}>")

# replace location row head block
old_head = """                <div className={styles.locationRowHead}>
                  <button
                    type="button"
                    className={styles.locationSelectBtn}
                    onClick={() => setActivePlaceInfoId(row.place.id)}
                    aria-pressed={isInfoTarget}
                  >
                    <span className={styles.placePill}>
                      <span aria-hidden>📍</span> {row.place.title}
                      {row.primary ? <span className={styles.placeMeta}>Primary</span> : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.locationInfoLink} ${isInfoTarget ? styles.locationInfoLinkActive : ''}`}
                    onClick={() => {
                      setActivePlaceInfoId(row.place.id);
                      setLocationsExpanded(true);
                    }}
                  >
                    Place info
                  </button>
                </div>"""

new_head = """                <div className={styles.locationRowHead}>
                  <div className={styles.locationPillRow}>
                    <button
                      type="button"
                      className={styles.locationSelectBtn}
                      onClick={() => setActivePlaceInfoId(row.place.id)}
                      aria-pressed={isInfoTarget}
                    >
                      <span className={styles.placePill}>
                        <span aria-hidden>📍</span> {row.place.title}
                        {row.primary ? <span className={styles.placeMeta}>Primary</span> : null}
                      </span>
                    </button>
                    {!isShared ? (
                      <div className={styles.locationInlineActions}>
                        {!row.primary ? (
                          <button
                            type="button"
                            className={styles.iconActionBtn}
                            onClick={() => {
                              const list = dayLocations.additional.map((x) => ({ ...x }));
                              const addIdx = idx - 1;
                              if (addIdx < 0) return;
                              list[addIdx] = { ...list[addIdx], returnToPrimary: !list[addIdx].returnToPrimary };
                              updateLocations(dayLocations.primary?.id ?? '', list.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
                            }}
                            title={`Return to primary: ${row.returnToPrimary ? 'Yes' : 'No'}`}
                          >
                            ↩
                          </button>
                        ) : null}
                        {!row.primary ? (
                          <button
                            type="button"
                            className={styles.iconActionBtn}
                            onClick={() => {
                              const addIdx = idx - 1;
                              if (addIdx < 0 || !dayLocations.primary) return;
                              const nextPrimary = dayLocations.additional[addIdx];
                              const remaining = dayLocations.additional
                                .filter((_, i) => i !== addIdx)
                                .map((x) => ({ ...x }));
                              remaining.unshift({ placeId: dayLocations.primary.id, place: dayLocations.primary, returnToPrimary: true });
                              updateLocations(nextPrimary.place.id, remaining.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
                            }}
                            title="Set as primary"
                          >
                            ★
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={styles.iconActionBtn}
                          onClick={() => {
                            if (row.primary) {
                              const firstAdditional = dayLocations.additional[0];
                              if (!firstAdditional) {
                                updateLocations('', []);
                                return;
                              }
                              updateLocations(
                                firstAdditional.place.id,
                                dayLocations.additional.slice(1).map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary }))
                              );
                            } else {
                              const addIdx = idx - 1;
                              updateLocations(
                                dayLocations.primary?.id ?? '',
                                dayLocations.additional.filter((_, i) => i !== addIdx).map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary }))
                              );
                            }
                          }}
                          title="Remove location"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          className={styles.iconActionBtn}
                          disabled={idx === 0}
                          onClick={() => {
                            if (idx === 0) return;
                            const rows = dayLocations.additional.map((x) => ({ ...x }));
                            const current = idx - 1;
                            const prior = current - 1;
                            if (current < 0 || prior < 0 || !dayLocations.primary) return;
                            const temp = rows[prior];
                            rows[prior] = rows[current];
                            rows[current] = temp;
                            updateLocations(dayLocations.primary.id, rows.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
                          }}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={styles.iconActionBtn}
                          disabled={idx === 0 || idx >= dayLocations.additional.length}
                          onClick={() => {
                            const rows = dayLocations.additional.map((x) => ({ ...x }));
                            const current = idx - 1;
                            if (current < 0 || current >= rows.length - 1 || !dayLocations.primary) return;
                            const temp = rows[current + 1];
                            rows[current + 1] = rows[current];
                            rows[current] = temp;
                            updateLocations(dayLocations.primary.id, rows.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
                          }}
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={`${styles.locationInfoLink} ${isInfoTarget ? styles.locationInfoLinkActive : ''}`}
                    onClick={() => {
                      setActivePlaceInfoId(row.place.id);
                      setLocationsExpanded(true);
                    }}
                  >
                    Place info
                  </button>
                </div>"""

if old_head not in t:
    raise SystemExit("head block not found")
t = t.replace(old_head, new_head)

# remove old locationActions block
import re
t = re.sub(
    r"\n                \{\!isShared \? \(\n                  <div className=\{styles\.locationActions\}\>.*?</motionlessDialog>\n                \) : null\}",
    "",
    t,
    count=1,
    flags=re.DOTALL,
)
t = t.replace("</motionlessDialog>", "</div>")  # cleanup if any

# remove right actions - from rightActions to end of tipOpen
right_start = t.index("        {isShared ? null : (")
right_end = t.index("      </div>\n    </header>")
# find the block with rightActions
idx = t.index("<div className={styles.rightActions}>")
end = t.index("{tipOpen ?", idx)
if end < 0:
    end = t.index("        {tipOpen ?", idx)
# remove from isShared ? null : ( through tip calculator
block_start = t.rfind("        {isShared ? null : (", 0, idx)
block_end = t.find("      </motionlessDialog>", idx)
if block_end < 0:
    block_end = t.find("      </div>\n    </header>", idx)
# simpler: remove rightActions div and tipOpen section
t2 = t
for marker in [
    "        {isShared ? null : (\n          <div className={styles.rightActions}>",
]:
    if marker in t2:
        start = t2.index(marker)
        # find matching close for rightActions - ends with `        )}`
        end_marker = "          </div>\n        )}"
        end = t2.index(end_marker, start) + len(end_marker)
        t2 = t2[:start] + t2[end:]

for marker in ["        {tipOpen ? (", "        {tipOpen ?"]:
    if marker in t2:
        start = t2.index(marker)
        end = t2.index("        ) : null}", start) + len("        ) : null}")
        t2 = t2[:start] + t2[end:]

t = t2

# place info only when expanded
t = t.replace(
    "        {locationsExpanded ? (\n          <div className={styles.placeInfoCard}>",
    "        {locationsExpanded ? (\n          <div className={styles.placeInfoCard}>",
)

p.write_text(t, encoding="utf-8")
print("patched day header")
