# app/routers/rollback.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Branch, Commit, User
from ..routers.auth import get_current_user

router = APIRouter(
    prefix="/rollback",
    tags=["rollback"],
    dependencies=[Depends(get_current_user)],
)


@router.post(
    "/{branch_id}/{commit_id}",
    summary="Roll a branch back to a specific commit",
    status_code=status.HTTP_200_OK,
)
def rollback_branch(
    branch_id: int,
    commit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1) fetch branch owned by current_user
    branch = (
        db.query(Branch)
          .filter(
              Branch.id == branch_id,
              Branch.owner_id == current_user.id,
          )
          .first()
    )
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch not found"
        )

    # 2) fetch commit owned by current_user
    commit = (
        db.query(Commit)
          .filter(
              Commit.id == commit_id,
              Commit.owner_id == current_user.id,
          )
          .first()
    )
    if not commit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commit not found"
        )

    # 3) ensure it belongs to that branch
    if commit.branch_id != branch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot roll back: commit does not belong to this branch"
        )

    # 4) perform rollback
    branch.current_commit_id = commit.id
    db.commit()

    return {
        "message": f"Branch '{branch.name}' rolled back to commit {commit.commit_hash}"
    }
