from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import hashlib

from .database import SessionLocal
from . import models
from .models import Commit, Branch
from .routers import commit, branch, rollback, tag  # All routers

# Initialize FastAPI app
app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://chatcommit.fly.dev",
        "chrome-extension://obciponildojcfgfajioeomjkihdadbc",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health and root endpoints
@app.get("/")
async def root():
    return {"message": "Welcome to ChatCommit from main.py!"}

@app.get("/health")
def health():
    return {"status": "ok"}

# Database initialization (auto-create a default branch if needed)
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
                branch_id=1
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

@app.on_event("startup")
def startup_event():
    initialize_default_branch()

# Include API routers under the /api prefix (update your extension accordingly)
app.include_router(commit.router, prefix="/api/commit", tags=["commit"])
app.include_router(branch.router, prefix="/api/branch", tags=["branch"])
app.include_router(rollback.router, prefix="/api/rollback", tags=["rollback"])
app.include_router(tag.router, prefix="/api/tag", tags=["tag"])
