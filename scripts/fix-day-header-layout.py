from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "components" / "day" / "DayHeader.tsx"
t = p.read_text(encoding="utf-8")
t = t.replace("motionlessDialog", "div")

if "PanelCollapseToggle" not in t:
    t = t.replace(
        "import { PlaceInfoPanel } from './PlaceInfoPanel';",
        "import { PanelCollapseToggle } from '../shared/PanelCollapseToggle';\nimport { PlaceInfoPanel } from './PlaceInfoPanel';",
    )

t = t.replace("      <div className={styles.left}>", "      <motionlessDialog className={styles.titleBlock}>", 1)
t = t.replace("<motionlessDialog className={styles.titleBlock}>", "<div className={styles.titleBlock}>", 1)

old = """        <div className={styles.date}>
          {day.dayType === 'PreTrip' ? 'Before trip starts' : formatDayDate(day.calendarDate)}
        </div>
        {locationsExpanded ? (
        <div className={styles.placeSection}>
          <div className={styles.alsoVisiting}>Locations</div>"""

new = """        <motionlessDialog className={styles.date}>
          {day.dayType === 'PreTrip' ? 'Before trip starts' : formatDayDate(day.calendarDate)}
        </motionlessDialog>
      </motionlessDialog>
      <div className={styles.locationsColumn}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Locations</h2>
          <PanelCollapseToggle
            expanded={locationsExpanded}
            onToggle={() => setLocationsExpanded((v) => !v)}
            expandTitle="Show locations and place info"
            collapseTitle="Hide locations and place info"
          />
        </motionlessDialog>
        {locationsExpanded ? (
        <div className={styles.placeSection}>"""

old = """        <div className={styles.date}>
          {day.dayType === 'PreTrip' ? 'Before trip starts' : formatDayDate(day.calendarDate)}
        </div>
        {locationsExpanded ? (
        <div className={styles.placeSection}>
          <div className={styles.alsoVisiting}>Locations</div>"""

new = """        <div className={styles.date}>
          {day.dayType === 'PreTrip' ? 'Before trip starts' : formatDayDate(day.calendarDate)}
        </div>
      </div>
      <div className={styles.locationsColumn}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Locations</h2>
          <PanelCollapseToggle
            expanded={locationsExpanded}
            onToggle={() => setLocationsExpanded((v) => !v)}
            expandTitle="Show locations and place info"
            collapseTitle="Hide locations and place info"
          />
        </div>
        {locationsExpanded ? (
        <div className={styles.placeSection}>"""

if old not in t:
    raise SystemExit("block not found")
t = t.replace(old, new)

t = t.replace("motionlessDialog", "div")

p.write_text(t, encoding="utf-8")
print("ok")
