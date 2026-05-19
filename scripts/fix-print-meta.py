from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "utils" / "dayPlannerPrintHtml.ts"
lines = p.read_text(encoding="utf-8").splitlines(True)
out = []
skip_next_dup = False
for i, line in enumerate(lines):
    if "motionlessDialog" in line:
        continue
    if i > 0 and "if (e.details?.length)" in line and "if (e.details?.length)" in lines[i - 1]:
        continue
    out.append(line)
p.write_text("".join(out), encoding="utf-8")
print("ok")
