from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "components" / "day" / "DayHeader.tsx"
t = p.read_text(encoding="utf-8")
start = t.index("              .map((row, idx) => {")
end = t.index("            })}\n          </motionlessDialog>")
if end < 0:
    end = t.index("            })}\n          </div>\n          {locationMessage")

block = r"""              .map((row, idx) => {
              const isInfoTarget = activePlaceInfoId === row.place.id;
              return (
              <div
                key={row.place.id}
                className={`${styles.locationRow} ${isInfoTarget ? styles.locationRowActive : ''}`}
              >
                <div className={styles.locationRowHead}>
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
                      setPlaceInfoOpen(true);
                    }}
                  >
                    Place info
                  </button>
                </div>
                {!isShared && row.primary && followingDayOptions.length ? (
                  <div className={styles.locationCopyRow}>
                    <span className={styles.infoSub}>Same location for next</span>
                    <select
                      className={styles.copyLocationSelect}
                      value={copyDaysCount}
                      onChange={(e) => setCopyDaysCount(Number(e.target.value))}
                      aria-label="Number of following days"
                    >
                      {followingDayOptions.map((n) => (
                        <option key={n} value={n}>
                          {n} day{n === 1 ? '' : 's'}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.clearPlaceBtn}
                      onClick={() => applyPrimaryToFollowingDays(copyDaysCount)}
                    >
                      Apply
                    </button>
                  </div>
                ) : null}
                {!isShared ? (
                  <div className={styles.locationActions}>
                      {!row.primary ? (
                        <button
                          type="button"
                          className={styles.clearPlaceBtn}
                          onClick={() => {
                            const list = dayLocations.additional.map((x) => ({ ...x }));
                            const addIdx = idx - 1;
                            if (addIdx < 0) return;
                            list[addIdx] = { ...list[addIdx], returnToPrimary: !list[addIdx].returnToPrimary };
                            updateLocations(dayLocations.primary?.id ?? '', list.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
                          }}
                          aria-label="Toggle return to primary"
                        >
                          Return: {row.returnToPrimary ? 'Yes' : 'No'}
                        </button>
                      ) : null}
                      {!row.primary ? (
                        <button
                          type="button"
                          className={styles.clearPlaceBtn}
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
                          aria-label="Set as primary"
                        >
                          Set as primary
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.clearPlaceBtn}
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
                        aria-label="Remove location"
                      >
                        ×
                      </button>
                      <button
                        type="button"
                        className={styles.clearPlaceBtn}
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
                        aria-label="Move location up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.clearPlaceBtn}
                        onClick={() => {
                          const rows = dayLocations.additional.map((x) => ({ ...x }));
                          const current = idx - 1;
                          if (current < 0 || current >= rows.length - 1 || !dayLocations.primary) return;
                          const temp = rows[current + 1];
                          rows[current + 1] = rows[current];
                          rows[current] = temp;
                          updateLocations(dayLocations.primary.id, rows.map((x) => ({ placeId: x.placeId, returnToPrimary: x.returnToPrimary })));
                        }}
                        aria-label="Move location down"
                      >
                        ↓
                      </button>
                  </div>
                ) : null}
                <a className={styles.mapLink} href={`https://www.google.com/maps/@${row.place.latitude},${row.place.longitude},10z`} target="_blank" rel="noopener noreferrer">
                  Open in Google Maps
                </a>
              </div>
              );
            })}
"""

# find end marker
end = t.index("            })}\n          </motionlessDialog>", start)
if end < 0:
    end = t.index("            })}\n          </motionlessDialog>", start)
if end < 0:
    end = t.index("            })}\n          </motionlessDialog>", start)
if end < 0:
    for marker in ["            })}\n          </div>\n          {locationMessage", "            })}\n          </div>"]:
        end = t.index(marker, start)
        if end >= 0:
            break

if end < 0:
    raise SystemExit("end not found")

p.write_text(t[:start] + block + t[end:], encoding="utf-8")
print("locations ok", end)

# remove copy from place info card
t = p.read_text(encoding="utf-8")
old = """                {!isShared && followingDayOptions.length ? (
                  <div className={styles.copyLocationRow}>
                    <span className={styles.infoSub}>Same primary location for next</span>
                    <select
                      className={styles.copyLocationSelect}
                      value={copyDaysCount}
                      onChange={(e) => setCopyDaysCount(Number(e.target.value))}
                      aria-label="Number of following days"
                    >
                      {followingDayOptions.map((n) => (
                        <option key={n} value={n}>
                          {n} day{n === 1 ? '' : 's'}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.clearPlaceBtn}
                      onClick={() => applyPrimaryToFollowingDays(copyDaysCount)}
                    >
                      Apply
                    </button>
                  </div>
                ) : null}
"""
if old in t:
    t = t.replace(old, "")
    p.write_text(t, encoding="utf-8")
    print("removed copy from place info")
else:
    print("copy block not found")
