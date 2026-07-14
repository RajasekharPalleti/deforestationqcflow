from fastapi import APIRouter

from ..config import DEPARTMENTS, ROLES
from ..team_members import TEAM_MEMBERS

router = APIRouter(prefix="/api", tags=["workspace"])


@router.get("/config")
def get_config():
    return {
        "departments": DEPARTMENTS,
        "roles": ROLES,
    }


@router.get("/team-members")
def get_team_members():
    return TEAM_MEMBERS
