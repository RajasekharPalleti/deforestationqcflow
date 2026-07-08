from typing import Optional

from fastapi import APIRouter

from ..db import get_db
from ..plots_service import get_plots, get_stats, sync_plots
from ..schemas import SyncRequest

router = APIRouter(prefix="/api/plots", tags=["plots"])


@router.post("/sync")
def sync(req: SyncRequest):
    sync_plots(req.tenant, req.project, req.model_name)
    return {"ok": True}


@router.get("")
def list_plots(
    tenant: str, project: str, model_name: str,
    detection_status: Optional[str] = None,
    publish_status: Optional[str] = None,
    qa_status: Optional[str] = None,
    pipeline_flag: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    plot_id_search: Optional[str] = None,
):
    filters = {
        "detection_status": detection_status,
        "publish_status": publish_status,
        "qa_status": qa_status,
        "pipeline_flag": pipeline_flag,
        "date_from": date_from,
        "date_to": date_to,
        "plot_id_search": plot_id_search,
    }
    return get_plots(tenant, project, model_name, filters)


@router.get("/stats")
def stats(tenant: str, project: str, model_name: str):
    return get_stats(tenant, project, model_name)


@router.get("/count")
def count(tenant: str, project: str, model_name: str):
    conn = get_db()
    n = conn.execute(
        "SELECT COUNT(*) FROM plots WHERE tenant=? AND project=? AND model_name=?",
        (tenant, project, model_name)).fetchone()[0]
    return {"count": n}
