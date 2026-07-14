from fastapi import APIRouter

from ..db import get_db
from ..schemas import LogActivityRequest

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("")
def get_activity(tenant: str, model_name: str):
    conn = get_db()
    logs = conn.execute(
        "SELECT * FROM activity_log WHERE tenant=? AND model_name=?"
        " ORDER BY ts DESC LIMIT 300",
        (tenant, model_name)).fetchall()
    return [dict(r) for r in logs]


@router.post("")
def log_activity(req: LogActivityRequest):
    """Records one real QA/DS review or publish action, called right after the real Cropin API call succeeds/fails."""
    conn = get_db()
    conn.execute(
        "INSERT INTO activity_log (tenant,project,model_name,plot_id,username,action,details)"
        " VALUES (?,?,?,?,?,?,?)",
        (req.tenant, req.project, req.model_name, req.plot_id, req.username, req.action, req.details))
    conn.commit()
    return {"ok": True}
