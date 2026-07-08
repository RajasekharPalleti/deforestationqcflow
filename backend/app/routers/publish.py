from datetime import datetime

from fastapi import APIRouter

from ..db import get_db, log_action
from ..schemas import PublishRequest

router = APIRouter(prefix="/api/publish", tags=["publish"])


@router.get("/ready")
def ready_to_publish(tenant: str, project: str, model_name: str):
    conn = get_db()
    ready = conn.execute(
        "SELECT * FROM plots WHERE tenant=? AND project=? AND model_name=?"
        " AND final_status IS NOT NULL AND publish_status='unpublished'"
        " ORDER BY pipeline_flag DESC",
        (tenant, project, model_name)).fetchall()
    already = conn.execute(
        "SELECT COUNT(*) FROM plots WHERE tenant=? AND project=? AND model_name=?"
        " AND publish_status='published'",
        (tenant, project, model_name)).fetchone()[0]
    no_final = conn.execute(
        "SELECT COUNT(*) FROM plots WHERE tenant=? AND project=? AND model_name=?"
        " AND final_status IS NULL AND publish_status='unpublished'",
        (tenant, project, model_name)).fetchone()[0]
    return {
        "ready": [dict(r) for r in ready],
        "already_published": already,
        "no_final_status": no_final,
    }


@router.post("")
def publish(req: PublishRequest):
    conn = get_db()
    ready = conn.execute(
        "SELECT id, plot_id, final_status FROM plots WHERE tenant=? AND project=? AND model_name=?"
        " AND final_status IS NOT NULL AND publish_status='unpublished'",
        (req.tenant, req.project, req.model_name)).fetchall()
    now = datetime.now().isoformat()
    for p in ready:
        conn.execute(
            "UPDATE plots SET publish_status='published',published_at=?,published_by=? WHERE id=?",
            (now, req.username, p["id"]))
        log_action(conn, req.tenant, req.project, req.model_name, p["plot_id"],
                   req.username, "Published", p["final_status"])
    conn.commit()
    return {"published": len(ready)}
