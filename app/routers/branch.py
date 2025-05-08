# app/routers/branch.py

from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Branch, Commit
from ..schemas import BranchCreate, BranchResponse, CommitResponse
# from ..routers.auth import get_current_user  # if you enforce auth

router = APIRouter(
    prefix="/branch",
    tags=["branches"],
)


@router.post(
    "/",
    response_model=BranchResponse,
    summary="Create a new branch",
)
def create_branch(
    branch: BranchCreate,
    db: Session = Depends(get_db),
):
    if branch.base_commit_id is not None:
        base_commit = db.query(Commit).get(branch.base_commit_id)
        if not base_commit:
            raise HTTPException(status_code=404, detail="Base commit not found")

    db_branch = Branch(
        name=branch.name,
        current_commit_id=branch.base_commit_id,
    )
    db.add(db_branch)
    db.commit()
    db.refresh(db_branch)
    return db_branch


@router.get(
    "/",
    response_model=List[BranchResponse],
    summary="List all branches",
)
def list_branches(
    db: Session = Depends(get_db),
):
    return db.query(Branch).all()


@router.get(
    "/{branch_id}",
    response_model=BranchResponse,
    summary="Get a single branch",
)
def get_branch(
    branch_id: int,
    db: Session = Depends(get_db),
):
    branch = db.query(Branch).get(branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.get(
    "/{branch_id}/commits",
    response_model=List[CommitResponse],
    summary="List all commits on a branch",
)
def get_commits_for_branch(
    branch_id: int,
    db: Session = Depends(get_db),
):
    branch = db.query(Branch).get(branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    commits = (
        db.query(Commit)
        .filter(Commit.branch_id == branch_id)
        .order_by(Commit.created_at.desc())
        .all()
    )
    return commits


@router.get(
    "/{branch_id}/head",
    response_model=Dict[str, Any],
    summary="Get the head (latest) commit of a branch",
)
def get_branch_head(
    branch_id: int,
    db: Session = Depends(get_db),
):
    branch = db.query(Branch).get(branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    head_commit = (
        db.query(Commit)
        .get(branch.current_commit_id)
    )
    return {
        "branch": branch.name,
        "head_commit": head_commit,
    }
