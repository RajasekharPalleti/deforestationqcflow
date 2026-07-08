import re
from datetime import datetime

from fastapi import APIRouter, HTTPException, Response

from ..db import get_db
from ..schemas import EvidenceRequest

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


def _safe_filename_part(s: str) -> str:
    """Content-Disposition headers must be latin-1 — strip anything else (e.g. em dashes)."""
    return re.sub(r"[^A-Za-z0-9_-]+", "_", s).strip("_")


@router.post("/generate")
def generate_evidence(req: EvidenceRequest):
    conn = get_db()
    if not req.plot_ids:
        raise HTTPException(400, "No plot ids provided")
    placeholders = ",".join("?" * len(req.plot_ids))
    rows = conn.execute(
        f"SELECT * FROM plots WHERE id IN ({placeholders}) AND pipeline_flag IN ('Flagged','Alert','Outlier')",
        req.plot_ids).fetchall()
    flagged = [dict(r) for r in rows]

    rows_html = "".join(
        f"<tr><td>{p['plot_id']}</td><td>{p['farmer_id']}</td>"
        f"<td>{p['lat']}, {p['lon']}</td><td>{p['detection_status']}</td></tr>"
        for p in flagged)
    html = f"""<!DOCTYPE html><html><head><meta charset='UTF-8'>
<title>Evidence — {req.tenant} · {req.project} — {req.model_name}</title>
<style>body{{font-family:Arial;background:#0F1117;color:#E8EAED;padding:20px}}
h1{{color:#4CAF50}} table{{width:100%;border-collapse:collapse;margin-top:16px}}
th{{background:#1B5E20;padding:8px 12px;text-align:left}}
td{{padding:8px 12px;border-bottom:1px solid #222}}
.box{{background:#1A2A1A;border-radius:10px;padding:20px;margin:16px 0;text-align:center}}
</style></head><body>
<h1>🌍 Satellite Evidence Report</h1>
<h2>{req.tenant} · {req.project} — {req.model_name}</h2>
<p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')} · {len(flagged)} flagged plots</p>
<div class='box'>
  <div style='font-size:32px'>🛰️</div>
  <div style='font-size:18px;margin:8px'>Satellite Evidence Viewer</div>
  <div style='color:#888'>Sentinel-2 RGB + SWIR + NDVI composites render here per plot.<br>
  API: POST /api/evidence/generate · Body: plot_ids, date_range, bands=[RGB,SWIR,NDVI]</div>
</div>
<table><thead><tr><th>Plot ID</th><th>Farmer ID</th><th>Coords</th><th>Detection</th></tr></thead>
<tbody>{rows_html}</tbody></table>
</body></html>"""

    filename = (
        f"Evidence_{_safe_filename_part(req.tenant)}_{_safe_filename_part(req.project)}"
        f"_{_safe_filename_part(req.model_name)}.html"
    )
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
