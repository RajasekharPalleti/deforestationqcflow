from datetime import datetime

from fastapi import APIRouter, HTTPException

from ..db import get_db, log_action
from ..schemas import BulkUpdateRequest, SaveEditsRequest

router = APIRouter(prefix="/api/review", tags=["review"])


@router.patch("/bulk")
def bulk_update(req: BulkUpdateRequest):
    if not req.plot_ids:
        raise HTTPException(400, "No plots selected — tick the checkboxes or use Select All first.")
    if req.role not in ("QA", "DS"):
        raise HTTPException(400, "role must be QA or DS")

    conn = get_db()
    now = datetime.now().isoformat()

    # Need plot_id (string) per row id for activity log
    rows = {r["id"]: r["plot_id"] for r in conn.execute(
        f"SELECT id, plot_id FROM plots WHERE id IN ({','.join('?' * len(req.plot_ids))})",
        req.plot_ids).fetchall()}

    for pid in req.plot_ids:
        plot_id_str = rows.get(pid)
        if req.role == "QA":
            conn.execute(
                "UPDATE plots SET qa_status=?,qa_reason=?,qa_user=?,qa_at=? WHERE id=?",
                (req.status, req.reason or "", req.username, now, pid))
            log_action(conn, req.tenant, req.project, req.model_name, plot_id_str,
                       req.username, "Bulk QA", f"{req.status}/{req.reason or ''}")
        else:
            conn.execute(
                "UPDATE plots SET ds_status=?,ds_user=?,ds_at=?,final_status=? WHERE id=?",
                (req.status, req.username, now, req.status, pid))
            log_action(conn, req.tenant, req.project, req.model_name, plot_id_str,
                       req.username, "Bulk DS", req.status)
    conn.commit()
    return {"updated": len(req.plot_ids)}


@router.patch("/save")
def save_edits(req: SaveEditsRequest):
    if req.role not in ("QA", "DS"):
        raise HTTPException(400, "role must be QA or DS")

    conn = get_db()
    now = datetime.now().isoformat()
    saved = 0

    for edit in req.edits:
        row = conn.execute("SELECT * FROM plots WHERE id=?", (edit.id,)).fetchone()
        if not row:
            continue
        if req.role == "QA":
            ns, nr, nc = edit.status, edit.reason or "", edit.comments or ""
            if ns != row["qa_status"] or nr != (row["qa_reason"] or "") or nc != (row["qa_comments"] or ""):
                conn.execute(
                    "UPDATE plots SET qa_status=?,qa_reason=?,qa_comments=?,qa_user=?,qa_at=? WHERE id=?",
                    (ns, nr, nc, req.username, now, edit.id))
                log_action(conn, req.tenant, req.project, req.model_name, row["plot_id"], req.username, "QA Save", ns)
                saved += 1
        else:
            ns, nc = edit.status, edit.comments or ""
            if ns != row["ds_status"] or nc != (row["ds_comments"] or ""):
                conn.execute(
                    "UPDATE plots SET ds_status=?,ds_comments=?,ds_user=?,ds_at=?,final_status=? WHERE id=?",
                    (ns, nc, req.username, now, ns, edit.id))
                log_action(conn, req.tenant, req.project, req.model_name, row["plot_id"], req.username, "DS Save", ns)
                saved += 1

    conn.commit()
    return {"saved": saved}
