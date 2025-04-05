# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib
import os

from .database import SessionLocal
from .models import Commit, Branch
from .routers import commit, branch, rollback, tag

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

def initialize_default_branch():
    db: Session = SessionLocal()
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
    initialize_default_branch()

# ✅ API endpoints under /api/*
app.include_router(commit.router, prefix="/api/commit", tags=["commit"])
app.include_router(branch.router, prefix="/api/branch", tags=["branch"])
app.include_router(rollback.router, prefix="/api/rollback", tags=["rollback"])
app.include_router(tag.router, prefix="/api/tag", tags=["tag"])
