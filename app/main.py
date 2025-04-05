# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib
import os

from .database import SessionLocal, engine
from .models import Base, Commit, Branch  # <-- Add Base
from .routers import commit, branch, rollback, tag

app = FastAPI(redirect_slashes=False)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://chatcommit.fly.dev",
        "https://chat-commit-git-main-nicholas-bessmers-projects.vercel.app",
        "chrome-extension://obciponildojcfgfajioeomjkihdadbc",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "ChatCommit backend"}

@app.get("/health")
def health():
    return {"status": "ok"}

from .database import SessionLocal, engine  # include engine
from .models import Base, Commit, Branch    # include Base

from .database import SessionLocal, engine
from .models import Base, Commit, Branch

from sqlalchemy import text

def initialize_default_branch():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='branches'"))
    if not result.fetchone():
        print("⚠️ Branches table does not exist, skipping init.")
        db.close()
        return

    if db.query(Branch).count() == 0:
        commit_hash = hashlib.sha1(b"init").hexdigest()
        init_commit = Commit(
            commit_hash=commit_hash,
            commit_message="init",
            conversation_context={},
            created_at=datetime.now(timezone.utc),
            branch_id=1
        )
        db.add(init_commit)
        db.commit()
        db.refresh(init_commit)

        main = Branch(name="main", current_commit_id=init_commit.id)
        db.add(main)
        db.commit()

    db.close()
    
@app.on_event("startup")
def on_startup():
    print("🚀 Ensuring DB schema...")
    Base.metadata.create_all(bind=engine)

    # 🔁 Instead of querying the DB immediately,
    # just do it inside a try/except block
    try:
        print("⚙️ Initializing default branch...")
        initialize_default_branch()
    except Exception as e:
        print(f"⚠️ Skipping init branch due to error: {e}")


# ✅ API endpoints at root level
app.include_router(branch.router, prefix="/branch")
app.include_router(commit.router, prefix="/commit")
app.include_router(rollback.router, prefix="/rollback")
app.include_router(tag.router, prefix="/tag")


