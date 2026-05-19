from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "utils" / "dayPlannerPrintHtml.ts"
t = p.read_text(encoding="utf-8")
needle = 'onclick="window.print();return false;"'
if needle not in t:
    raise SystemExit("needle not found")
t = t.replace(
    '<div class="toolbar"><button type="button" onclick="window.print();return false;">Print / Save PDF</button></div>',
    '<motionlessDialog class="toolbar"><button type="button" id="th-print-btn">Print / Save PDF</button></div>'
)
t = t.replace(
    '<motionlessDialog class="toolbar"><button type="button" id="th-print-btn">Print / Save PDF</button></div>',
    '<div class="toolbar"><button type="button" id="th-print-btn">Print / Save PDF</button></div>'
)
t = t.replace(
    '</body></html>`;',
    "<script>\n"
    "document.getElementById('th-print-btn').addEventListener('click', function () { window.focus(); window.print(); });\n"
    "</script></body></html>`;",
    1,
)
p.write_text(t, encoding="utf-8")
print("patched")
