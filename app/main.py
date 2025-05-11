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
from app.routers import (
    auth,
    branch,
    commit,
    tag,
    merge,
    timeline,
    rollback,
    user,
    subscription,
    stripe,
)

# set up logging
logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="ChatCommit API", version="0.1.0")  # 1

# ─── MIDDLEWARE ────────────────────────────────────────────────


# ─── CORS CONFIG ───────────────────────────────────────────────
# explicitly list all origins that will call your API
origins = [
    "https://chat-commit.vercel.app",  # your production frontend
    "http://localhost:3000",           # local dev
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # ← use the list you just defined
    allow_credentials=True,         # cookies / auth headers
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/", tags=["root"])
def root():  # 10
    return {"message": "ChatCommit backend"}

@app.get("/health", tags=["root"])
def health():  # 14
    return {"status": "ok"}

def initialize_default_branch():  # 18
    db: Session = SessionLocal()
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
def on_startup():  # Fifty
    # log environment and stripe config
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

# --- MOUNT ALL ROUTERS ---

# Authentication (register, login, activate, token)
# Mount each router exactly once, with the desired prefix:
app.include_router(auth.router,      prefix="/auth/users", tags=["auth"])
app.include_router(user.router,      prefix="/users",      tags=["user"])
app.include_router(branch.router,    prefix="/branch",     tags=["branch"])
app.include_router(commit.router,    prefix="/commit",     tags=["commit"])
app.include_router(commit.router,    prefix="/commits",    tags=["commits"])
app.include_router(tag.router,       prefix="/tag",        tags=["tag"])
app.include_router(timeline.router,  prefix="",            tags=["timeline"])  # uses its own "/timeline"
app.include_router(merge.router,     prefix="",            tags=["merge"])     # uses its own "/merge"
app.include_router(rollback.router,  prefix="/rollback",   tags=["rollback"])
app.include_router(subscription.router, prefix="/subscription")
app.include_router(stripe.router,    prefix="/stripe",     tags=["stripe"])
