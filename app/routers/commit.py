# app/routers/commit.py
from fastapi import APIRouter, Depends, HTTPException
router = APIRouter()
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Commit, Branch
from ..schemas import CommitCreate, CommitResponse
import hashlib
from datetime import datetime, timezone
from typing import List
router = APIRouter()
@router.get("/", response_model=list[CommitResponse])
def list_commits(db: Session = Depends(get_db)):
    return db.query(Commit).order_by(Commit.created_at.desc()).all()

@router.post("/", response_model=CommitResponse)
def create_commit(commit: CommitCreate, db: Session = Depends(get_db)):
    branch_id = commit.branch_id  # ✅ Fix: define branch_id

    sha_input = f"{datetime.now(timezone.utc).isoformat()}-{commit.commit_message}"
    commit_hash = hashlib.sha1(sha_input.encode()).hexdigest()

    existing_commit = db.query(Commit).filter(Commit.commit_hash == commit_hash).first()
    if existing_commit:
        raise HTTPException(status_code=400, detail="Duplicate commit detected.")

    # Determine parent commit for the branch
    parent_commit_id = None
    if branch_id:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if branch:
            parent_commit_id = branch.current_commit_id

    db_commit = Commit(
        commit_hash=commit_hash,
        commit_message=commit.commit_message,
        conversation_context=commit.conversation_context.dict(),  # ✅ convert to dict
        branch_id=branch_id,
        parent_commit_id=parent_commit_id
    )

    db.add(db_commit)
    db.commit()
    db.refresh(db_commit)

    # Update branch's HEAD
    if branch_id and branch:
        branch.current_commit_id = db_commit.id
        db.commit()

    return db_commit

@router.get("/{commit_id}", response_model=CommitResponse)
def get_commit(commit_id: int, db: Session = Depends(get_db)):
    commit = db.query(Commit).filter(Commit.id == commit_id).first()
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found")
    return commit
    
@router.get("/", response_model=List[CommitResponse])
def list_commits(db: Session = Depends(get_db)):
    return db.query(Commit).order_by(Commit.created_at.desc()).all()
