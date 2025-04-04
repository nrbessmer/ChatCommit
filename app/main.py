from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import engine, SessionLocal
from . import models
from .models import Commit, Branch
from .routers import commit, branch, rollback
from datetime import datetime, timezone
from app.routers import tag  # 👈 Add this line
import hashlib
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()
@app.get("/")
async def root():
    return {"message": "Hello world from main.py"}# Serve static frontend build

app.mount("/", StaticFiles(directory="frontend/out", html=True), name="frontend")

# Include your backend API routes
app.include_router(routes.router)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://chatcommit.fly.dev",
        "chrome-extension://obciponildojcfgfajioeomjkihdadbc"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import FastAPI
app = FastAPI()

# Existing code …

@app.get("/")
def read_root():
    return {"message": "Welcome to ChatCommit!"}

@app.get("/health")
def health():
    return {"status": "ok"}


# ✅ Auto-create main branch + initial commit if empty
def initialize_default_branch():
    db: Session = SessionLocal()
    try:
        if db.query(Branch).count() == 0:
            print("🌱 No branches found. Creating default 'main' branch...")

            timestamp = datetime.now(timezone.utc).isoformat()
            commit_message = "Initial commit (auto-generated)"
            commit_hash = hashlib.sha1(f"{timestamp}-{commit_message}".encode()).hexdigest()

            initial_commit = Commit(
            commit_hash=commit_hash,
            commit_message=commit_message,
            conversation_context={"messages": ["Auto-init by ChatCommit"]},
            created_at=datetime.now(timezone.utc),
            branch_id=1  # ✅ Link it to the soon-to-be 'main' branch
)

            db.add(initial_commit)
            db.commit()
            db.refresh(initial_commit)

            main_branch = Branch(
                name="main",
                current_commit_id=initial_commit.id
            )
            db.add(main_branch)
            db.commit()

            print(f"✅ Initialized 'main' branch with commit {commit_hash}")
    finally:
        db.close()

# ✅ Run init on startup
@app.on_event("startup")
def startup_event():
    initialize_default_branch()
from .routers import commit, branch, rollback, tag  # <-- ✅ Make sure 'tag' is included

app.include_router(commit.router, prefix="/commit", tags=["commit"])
app.include_router(branch.router, prefix="/branch", tags=["branch"])
app.include_router(rollback.router, prefix="/rollback", tags=["rollback"])
app.include_router(tag.router, prefix="/tag", tags=["tag"])  # <-- ✅ This line must be here
