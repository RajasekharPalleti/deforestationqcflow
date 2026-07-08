from fastapi import APIRouter

from ..db import get_db

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("")
def get_activity(tenant: str, project: str, model_name: str):
    conn = get_db()
    logs = conn.execute(
        "SELECT * FROM activity_log WHERE tenant=? AND project=? AND model_name=?"
        " ORDER BY ts DESC LIMIT 300",
        (tenant, project, model_name)).fetchall()
    return [dict(r) for r in logs]
