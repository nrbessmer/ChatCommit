# app/routers/branch.py

from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Branch, Commit, User
from ..schemas import BranchCreate, BranchResponse, CommitResponse
from ..routers.auth import get_current_user

router = APIRouter(tags=["branches"])


@router.post(
    "/",
    response_model=BranchResponse,
    summary="Create a new branch",
)
def create_branch(
    branch_in: BranchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # If basing off an existing commit, ensure it belongs to the user
    if branch_in.base_commit_id is not None:
        base = (
            db.query(Commit)
              .filter(
                  Commit.id == branch_in.base_commit_id,
                  Commit.owner_id == current_user.id
              )
              .first()
        )
        if not base:
            raise HTTPException(status_code=404, detail="Base commit not found")

    new_branch = Branch(
        name=branch_in.name,
        current_commit_id=branch_in.base_commit_id,
        owner_id=current_user.id,          # assumes you’ve added owner_id to Branch model
    )
    db.add(new_branch)
    db.commit()
    db.refresh(new_branch)
    return new_branch


@router.get(
    "/",
    response_model=List[BranchResponse],
    summary="List all your branches",
)
def list_branches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Branch)
          .filter(Branch.owner_id == current_user.id)
          .all()
    )


@router.get(
    "/{branch_id}",
    response_model=BranchResponse,
    summary="Get a single branch",
)
def get_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    br = (
        db.query(Branch)
          .filter(
              Branch.id == branch_id,
              Branch.owner_id == current_user.id
          )
          .first()
    )
    if not br:
        raise HTTPException(status_code=404, detail="Branch not found")
    return br


@router.get(
    "/{branch_id}/commits",
    response_model=List[CommitResponse],
    summary="List all commits on a branch",
)
def get_commits_for_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    br = (
        db.query(Branch)
          .filter(
              Branch.id == branch_id,
              Branch.owner_id == current_user.id
          )
          .first()
    )
    if not br:
        raise HTTPException(status_code=404, detail="Branch not found")

    # all commits owned by the user on that branch
    q = (
        db.query(Commit)
          .filter(
              Commit.branch_id == branch_id,
              Commit.owner_id == current_user.id
          )
    )
    if br.current_commit_id is not None:
        q = q.filter(Commit.id <= br.current_commit_id)

    return q.order_by(Commit.created_at.desc()).all()


@router.get(
    "/{branch_id}/head",
    response_model=Dict[str, Any],
    summary="Get the head (latest) commit of a branch",
)
def get_branch_head(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    br = (
        db.query(Branch)
          .filter(
              Branch.id == branch_id,
              Branch.owner_id == current_user.id
          )
          .first()
    )
    if not br:
        raise HTTPException(status_code=404, detail="Branch not found")

    head = (
        db.query(Commit)
          .filter(
              Commit.id == br.current_commit_id,
              Commit.owner_id == current_user.id
          )
          .first()
    )
    return {
        "branch": br.name,
        "head_commit": head,
    }
