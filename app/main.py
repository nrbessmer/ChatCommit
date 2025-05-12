# app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib
import os
import logging

from .database import SessionLocal, engine, Base
from .models import Commit, Branch
from .routers import (
    auth,
    user,
    branch,
    commit,
    tag,
    merge,
    rollback,
    timeline,
    subscription,
    stripe,
)

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="ChatCommit API", version="0.1.0")

# ─── CORS ───────────────────────────────────────────────────────────
origins = [
    "https://chat-commit.vercel.app",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
    if db.execute(text(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='branches'"
    )).first() and db.query(Branch).count() == 0:
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

        main_branch = Branch(name="main", current_commit_id=init_commit.id)
        db.add(main_branch)
        db.commit()
    db.close()

@app.on_event("startup")
def on_startup():
    stripe_key = os.getenv("STRIPE_SECRET_KEY")
    price_id   = os.getenv("STRIPE_PRICE_ID")
    logger.info(f"🔑 STRIPE_SECRET_KEY = {stripe_key[:8] + '…' if stripe_key else None}")
    logger.info(f"🔖 STRIPE_PRICE_ID   = {price_id}")

    print("🚀 Ensuring DB schema...")
    Base.metadata.create_all(bind=engine)

    try:
        print("⚙️ Initializing default branch...")
        initialize_default_branch()
    except Exception as e:
        print(f"⚠️ Skipping default-branch init: {e}")

# ─── MOUNT ROUTERS ─────────────────────────────────────────────────
app.include_router(auth.router,         prefix="/auth/users", tags=["auth"])
app.include_router(user.router,         prefix="/users",      tags=["user"])
app.include_router(branch.router,       prefix="/branch",     tags=["branch"])
app.include_router(commit.router)  # <- FIXED: removed double prefix
app.include_router(tag.router,          prefix="/tag",        tags=["tag"])
app.include_router(merge.router,        prefix="/merge",      tags=["merge"])
app.include_router(rollback.router,     prefix="/rollback",   tags=["rollback"])
app.include_router(timeline.router,     prefix="/timeline/",   tags=["timeline"])
app.include_router(subscription.router, prefix="/subscription", tags=["subscription"])
app.include_router(stripe.router,       prefix="/stripe",     tags=["stripe"])
