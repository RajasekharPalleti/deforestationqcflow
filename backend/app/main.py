from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import activity, auth, users, workspace

app = FastAPI(title="CropIn Validation Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(auth.router)
app.include_router(workspace.router)
app.include_router(activity.router)
app.include_router(users.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
