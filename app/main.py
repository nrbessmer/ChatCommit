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

def fix_all_branches_and_commits():
    """Fix all branch and commit relationships"""
    db = SessionLocal()
    try:
        # Get all branches
        branches = db.query(Branch).all()
        
        for branch in branches:
            # Get current head commit
            if branch.current_commit_id:
                # Update the head commit to point to correct branch
                db.execute(
                    text("UPDATE commits SET branch_id = :branch_id WHERE id = :commit_id"),
                    {"branch_id": branch.id, "commit_id": branch.current_commit_id}
                )
                
                # Update parent commits that might be part of this branch
                # but don't have branch_id set
                parent_id = db.execute(
                    text("SELECT parent_commit_id FROM commits WHERE id = :commit_id"),
                    {"commit_id": branch.current_commit_id}
                ).scalar()
                
                while parent_id:
                    # Update this parent
                    db.execute(
                        text("UPDATE commits SET branch_id = :branch_id WHERE id = :commit_id"),
                        {"branch_id": branch.id, "commit_id": parent_id}
                    )
                    
                    # Get next parent
                    parent_id = db.execute(
                        text("SELECT parent_commit_id FROM commits WHERE id = :commit_id"),
                        {"commit_id": parent_id}
                    ).scalar()
        
        db.commit()
        print("✅ Fixed all branch and commit relationships")
    except Exception as e:
        db.rollback()
        print(f"❌ Error fixing relationships: {str(e)}")
    finally:
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
app.include_router(timeline.router)
app.include_router(subscription.router, prefix="/subscription", tags=["subscription"])
app.include_router(stripe.router,       prefix="/stripe",     tags=["stripe"])
