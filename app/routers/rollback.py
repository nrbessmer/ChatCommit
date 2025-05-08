# app/routers/rollback.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Branch, Commit

router = APIRouter(  # **no** prefix here
    tags=["rollback"],
)


@router.post(
    "/{branch_id}/{commit_id}",
    summary="Roll a branch back to a specific commit",
)
def rollback_branch(
    branch_id: int,
    commit_id: int,
    db: Session = Depends(get_db),
):
    # 1) fetch branch
    branch = db.query(Branch).get(branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # 2) fetch commit
    commit = db.query(Commit).get(commit_id)
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found")

    # 3) ensure it belongs to that branch
    if commit.branch_id != branch_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot roll back: commit does not belong to this branch"
        )

    # 4) perform rollback
    branch.current_commit_id = commit.id
    db.commit()

    return {
        "message": f"Branch '{branch.name}' rolled back to commit {commit.commit_hash}"
    }
