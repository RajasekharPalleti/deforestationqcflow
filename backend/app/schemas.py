from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    department: str
    name: str


class UserOut(BaseModel):
    username: str
    display_name: str
    role: str


class SyncRequest(BaseModel):
    tenant: str
    project: str
    model_name: str


class BulkUpdateRequest(BaseModel):
    tenant: str
    project: str
    model_name: str
    role: str  # "QA" or "DS"
    username: str
    plot_ids: list[int]
    status: str
    reason: Optional[str] = ""


class IndividualEditItem(BaseModel):
    id: int
    status: str
    reason: Optional[str] = ""
    comments: Optional[str] = ""


class SaveEditsRequest(BaseModel):
    tenant: str
    project: str
    model_name: str
    role: str  # "QA" or "DS"
    username: str
    edits: list[IndividualEditItem]


class PublishRequest(BaseModel):
    tenant: str
    project: str
    model_name: str
    username: str


class AddUserRequest(BaseModel):
    username: str
    display_name: str
    role: str
    password: str


class EvidenceRequest(BaseModel):
    tenant: str
    project: str
    model_name: str
    plot_ids: list[int]
