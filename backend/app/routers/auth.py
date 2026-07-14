from fastapi import APIRouter, HTTPException

from ..config import DEPARTMENTS
from ..schemas import LoginRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(req: LoginRequest):
    if req.department not in DEPARTMENTS:
        raise HTTPException(400, "Unknown department")
    name = req.name.strip()
    # Names outside the known team list are allowed — the "Other" option on the
    # login page lets someone not on the list type their own name in.
    if not name:
        raise HTTPException(400, "Name is required")
    username = name.lower().replace(" ", "_")
    return UserOut(username=username, display_name=name, role=DEPARTMENTS[req.department])
