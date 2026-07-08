import json
import random
from datetime import date, timedelta

from .db import get_db

COORDS = {
    "BAT Brazil": (-15, -47), "BAT Indonesia": (-6, 107),
    "BAT Bangladesh": (23, 90), "ITC India": (17, 78), "Demo Tenant": (0, 0),
}
NAMES = {
    "BAT Brazil": ("BR", "José", "Maria", "Carlos"),
    "BAT Indonesia": ("ID", "Budi", "Siti", "Ahmad"),
    "BAT Bangladesh": ("BD", "Rahman", "Fatema", "Karim"),
    "ITC India": ("IN", "Raju", "Priya", "Suresh"),
    "Demo Tenant": ("DM", "Demo", "Test", "Sample"),
}


def sync_plots(tenant, project, model_name):
    """Simulates backend API fetch. Replace with real call in production."""
    random.seed(hash(f"{tenant}{project}{model_name}"))
    conn = get_db()

    pfx, *names = NAMES.get(tenant, ("XX", "Farmer"))
    blat, blon = COORDS.get(tenant, (0, 0))
    n = random.randint(60, 140)

    for i in range(n):
        plot_id = f"{pfx}-PLOT-{1000 + i}"
        farmer_id = f"{pfx}-FRM-{200 + (i % 30)}"
        farmer_name = random.choice(names)
        lat = round(blat + random.uniform(-2, 2), 6)
        lon = round(blon + random.uniform(-2, 2), 6)

        if model_name == "Deforestation":
            is_def = random.random() < 0.25
            det = "Deforested" if is_def else "Not Deforested"
            flag = "Flagged" if is_def else "Clean"
            defor_date = (date(2023, 1, 1) + timedelta(days=random.randint(0, 730))).isoformat() if is_def else None
            md = {"deforestation_date": defor_date or "—",
                  "deforested_area_ha": round(random.uniform(0.5, 12), 2) if is_def else 0.0,
                  "confidence_score": round(random.uniform(0.6, 0.99), 2)}
            pub = "published" if not is_def else "unpublished"

        elif model_name == "Yield Prediction":
            yld = round(random.uniform(1.5, 6.5), 2)
            det = "Predicted"
            flag = "Outlier" if (yld > 5.5 or yld < 2.0) else "Normal"
            md = {"predicted_yield_tha": yld,
                  "growth_stage": random.choice(["Vegetative", "Flowering", "Grain Fill", "Maturity"]),
                  "ndvi_avg": round(random.uniform(0.3, 0.85), 3),
                  "et_mm": round(random.uniform(2, 8), 2)}
            pub = "unpublished"

        elif model_name == "Crop Health":
            health = random.choice(["Healthy", "Mild Stress", "Moderate Stress", "Severe Stress"])
            det = health
            flag = "Alert" if "Stress" in health else "Normal"
            md = {"health_index": round(random.uniform(0.2, 0.95), 3),
                  "stress_level": health,
                  "affected_area_pct": round(random.uniform(0, 60), 1),
                  "alert_type": random.choice(["None", "Water Stress", "Pest", "Disease", "Nutrient"])
                  if "Stress" in health else "None"}
            pub = "unpublished"
        else:
            det, flag, md, pub = "N/A", "Normal", {}, "unpublished"

        ev_url = f"https://evidence.cropin.internal/{tenant.replace(' ', '_')}/{plot_id}.html"
        try:
            conn.execute("""
                INSERT INTO plots
                    (tenant,project,model_name,plot_id,farmer_id,farmer_name,
                     lat,lon,detection_status,pipeline_flag,publish_status,model_data,evidence_url)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(tenant,project,model_name,plot_id) DO UPDATE SET
                    detection_status=excluded.detection_status,
                    pipeline_flag=excluded.pipeline_flag,
                    model_data=excluded.model_data,
                    synced_at=datetime('now')
            """, (tenant, project, model_name, plot_id, farmer_id, farmer_name,
                  lat, lon, det, flag, pub, json.dumps(md), ev_url))
        except Exception:
            pass

    conn.commit()


def get_plots(tenant, project, model_name, filters=None):
    conn = get_db()
    q = "SELECT * FROM plots WHERE tenant=? AND project=? AND model_name=?"
    params = [tenant, project, model_name]
    f = filters or {}
    if f.get("detection_status") and f["detection_status"] != "All":
        q += " AND detection_status=?"; params.append(f["detection_status"])
    if f.get("publish_status") and f["publish_status"] != "All":
        q += " AND publish_status=?"; params.append(f["publish_status"])
    if f.get("qa_status") and f["qa_status"] != "All":
        q += " AND qa_status=?"; params.append(f["qa_status"])
    if f.get("pipeline_flag") and f["pipeline_flag"] not in (None, "All"):
        q += " AND pipeline_flag=?"; params.append(f["pipeline_flag"])
    if f.get("date_from"):
        q += " AND json_extract(model_data,'$.deforestation_date') NOT IN ('—')"                " AND json_extract(model_data,'$.deforestation_date') >= ?"; params.append(str(f["date_from"]))
    if f.get("date_to"):
        q += " AND json_extract(model_data,'$.deforestation_date') NOT IN ('—')"                " AND json_extract(model_data,'$.deforestation_date') <= ?"; params.append(str(f["date_to"]))
    if f.get("plot_id_search"):
        q += " AND plot_id LIKE ?"; params.append(f"%{f['plot_id_search']}%")
    rows = conn.execute(q, params).fetchall()
    return [dict(r) for r in rows]


def get_stats(tenant, project, model_name):
    conn = get_db()

    def n(q, *p):
        return conn.execute(q, p).fetchone()[0]

    base = "SELECT COUNT(*) FROM plots WHERE tenant=? AND project=? AND model_name=?"
    return {
        "total": n(base, tenant, project, model_name),
        "published": n(base + " AND publish_status='published'", tenant, project, model_name),
        "unpublished": n(base + " AND publish_status='unpublished'", tenant, project, model_name),
        "published_deforested": n(base + " AND publish_status='published' AND detection_status='Deforested'", tenant, project, model_name),
        "published_not_deforested": n(base + " AND publish_status='published' AND detection_status='Not Deforested'", tenant, project, model_name),
        "qa_pending": n(base + " AND qa_status='Pending' AND publish_status='unpublished'", tenant, project, model_name),
        "qa_done": n(base + " AND qa_status NOT IN ('Pending','Auto-Approved') AND ds_status='Pending'", tenant, project, model_name),
        "ds_pending": n(base + " AND ds_status='Pending' AND qa_status NOT IN ('Pending','Auto-Approved')", tenant, project, model_name),
        "ready_publish": n(base + " AND final_status IS NOT NULL AND publish_status='unpublished'", tenant, project, model_name),
    }
