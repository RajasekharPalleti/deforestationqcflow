from fastapi import APIRouter, HTTPException

from ..config import DEPARTMENTS
from ..schemas import LoginRequest, UserOut
from ..team_members import TEAM_MEMBERS

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(req: LoginRequest):
    if req.department not in DEPARTMENTS:
        raise HTTPException(400, "Unknown department")
    if req.name not in TEAM_MEMBERS.get(req.department, []):
        raise HTTPException(400, "Unknown name for this department")
    username = req.name.strip().lower().replace(" ", "_")
    return UserOut(username=username, display_name=req.name, role=DEPARTMENTS[req.department])
