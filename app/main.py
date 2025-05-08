# app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib

from .database import SessionLocal, engine, Base
from .models import Commit, Branch
from app.routers import (
    auth,
    branch,
    commit,
    tag,
    timeline,
    rollback,
    user,
    subscription,
    stripe,
)

app = FastAPI(title="ChatCommit API", version="0.1.0")

# ─── MIDDLEWARE ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["root"])
def root():
    return {"message": "ChatCommit backend"}

@app.get("/health", tags=["root"])
def health():
    return {"status": "ok"}

def initialize_default_branch():
    db: Session = SessionLocal()
    # only run if the branches table exists
    result = db.execute(text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='branches'"
    ))
    if not result.fetchone():
        db.close()
        return

    if db.query(Branch).count() == 0:
        # create the "init" commit
        commit_hash = hashlib.sha1(b"init").hexdigest()
        init_commit = Commit(
            commit_hash=commit_hash,
            commit_message="init",
            conversation_context={},
            created_at=datetime.now(timezone.utc),
            branch_id=None,
        )
        db.add(init_commit)
        db.commit()
        db.refresh(init_commit)

        # then the "main" branch
        main_branch = Branch(name="main", current_commit_id=init_commit.id)
        db.add(main_branch)
        db.commit()

    db.close()

@app.on_event("startup")
def on_startup():
    print("🚀 Ensuring DB schema...")
    Base.metadata.create_all(bind=engine)

    try:
        print("⚙️ Initializing default branch...")
        initialize_default_branch()
    except Exception as e:
        print(f"⚠️ Skipping default-branch init: {e}")

# --- MOUNT ALL ROUTERS ---

# ─── ROUTERS ───────────────────────────────────────────────────
# All of these will be under /auth/users, /branch, /commit, etc.
app.include_router(auth.router, prefix="/auth/users", tags=["auth"])
app.include_router(branch.router, prefix="/branch", tags=["branch"])
app.include_router(commit.router,     prefix="/commit",    tags=["commit"])
app.include_router(tag.router, prefix="/tag", tags=["tag"])
app.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
app.include_router(rollback.router, prefix="/rollback", tags=["rollback"])
# mount the same auth router under both prefixes
app.include_router(auth.router,       prefix="/auth/users", tags=["auth"])
app.include_router(auth.router,       prefix="/users",      tags=["auth"])
app.include_router(subscription.router, prefix="/subscription", tags=["subscription"])
app.include_router(stripe.router, prefix="/stripe", tags=["stripe"])
