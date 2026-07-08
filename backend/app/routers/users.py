import sqlite3

from fastapi import APIRouter, HTTPException

from ..db import get_db, hash_password
from ..schemas import AddUserRequest

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
def list_users():
    conn = get_db()
    rows = conn.execute("SELECT username,role,display_name FROM users ORDER BY role").fetchall()
    return [dict(r) for r in rows]


@router.post("")
def add_user(req: AddUserRequest):
    if not req.username or not req.password:
        raise HTTPException(400, "Username and password are required.")
    conn = get_db()
    try:
        conn.execute("INSERT INTO users VALUES (?,?,?,?)",
                     (req.username.strip().lower(), hash_password(req.password), req.role, req.display_name))
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Username exists.")
    return {"ok": True}
