from pydantic import BaseModel


class LoginRequest(BaseModel):
    department: str
    name: str


class UserOut(BaseModel):
    username: str
    display_name: str
    role: str


class AddUserRequest(BaseModel):
    username: str
    display_name: str
    role: str
    password: str


class LogActivityRequest(BaseModel):
    tenant: str
    project: str = ""
    model_name: str
    plot_id: str
    username: str
    action: str
    details: str = ""
