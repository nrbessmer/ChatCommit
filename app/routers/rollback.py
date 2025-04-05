from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Branch, Commit
from typing import List
router = APIRouter()

@router.post("/{branch_id}/{commit_id}")
def rollback_branch(branch_id: int, commit_id: int, db: Session = Depends(get_db)):
    branch = db.query(Branch).filter_by(id=branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    commit = db.query(Commit).filter_by(id=commit_id).first()
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found")

    if commit.branch_id != branch.id:
        raise HTTPException(status_code=400, detail="Commit does not belong to this branch")

    branch.current_commit_id = commit.id
    db.commit()

    return {
        "message": f"Branch '{branch.name}' rolled back to commit {commit.commit_hash}"
    }
@router.get("/test")
def test_rollback_router():
    return {"message": "Rollback router is active"}
