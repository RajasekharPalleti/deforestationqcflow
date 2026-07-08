from fastapi import APIRouter

from ..config import DEPARTMENTS, MODELS, ROLES, TENANT_PROJECTS, TENANTS
from ..team_members import TEAM_MEMBERS

router = APIRouter(prefix="/api", tags=["workspace"])


@router.get("/config")
def get_config():
    return {
        "tenants": TENANTS,
        "tenant_projects": TENANT_PROJECTS,
        "models": MODELS,
        "departments": DEPARTMENTS,
        "roles": ROLES,
    }


@router.get("/team-members")
def get_team_members():
    return TEAM_MEMBERS
