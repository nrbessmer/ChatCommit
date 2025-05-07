# app/routers/rollback.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Branch, Commit

router = APIRouter()

@router.post("/{branch_id}/{commit_id}")
def rollback_branch(
    branch_id: int,
    commit_id: int,
    db: Session = Depends(get_db)
):
    # 1) fetch branch
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(404, "Branch not found")

    # 2) fetch commit
    commit = db.query(Commit).filter(Commit.id == commit_id).first()
    if not commit:
        raise HTTPException(404, "Commit not found")

    # 3) ensure it belongs to that branch
    if commit.branch_id != branch.id:
        raise HTTPException(400, "Commit does not belong to this branch")

    # 4) roll the branch’s HEAD
    branch.current_commit_id = commit.id
    db.commit()

    return {"message": f"Branch '{branch.name}' rolled back to commit {commit.commit_hash}"}

