# app/routers/tag.py

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Tag, Commit, User
from ..schemas import TagCreate, TagResponse, CommitResponse
from ..routers.auth import get_current_user

router = APIRouter(
    tags=["tags"],
)


@router.post(
    "/",
    response_model=TagResponse,
    summary="Create a new tag on a commit",
)
def create_tag(
    tag: TagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # prevent duplicates
    existing = (
        db.query(Tag)
          .join(Commit, Commit.id == Tag.commit_id)
          .filter(
              Tag.name == tag.name,
              Tag.commit_id == tag.commit_id,
              Commit.owner_id == current_user.id
          )
          .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Tag already exists for this commit")

    # ensure commit exists and belongs to user
    commit = (
        db.query(Commit)
          .filter(
              Commit.id == tag.commit_id,
              Commit.owner_id == current_user.id
          )
          .first()
    )
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found")

    new_tag = Tag(name=tag.name, commit_id=tag.commit_id)
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return new_tag


@router.get(
    "/",
    response_model=List[TagResponse],
    summary="List all your tags",
)
def list_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Tag)
          .join(Commit, Commit.id == Tag.commit_id)
          .filter(Commit.owner_id == current_user.id)
          .order_by(Tag.created_at.desc())
          .all()
    )


@router.get(
    "/commit/{commit_id}",
    response_model=List[TagResponse],
    summary="List tags for a specific commit",
)
def tags_for_commit(
    commit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ensure commit belongs to user
    commit = (
        db.query(Commit)
          .filter(
              Commit.id == commit_id,
              Commit.owner_id == current_user.id
          )
          .first()
    )
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found")

    return (
        db.query(Tag)
          .filter(Tag.commit_id == commit_id)
          .order_by(Tag.created_at.desc())
          .all()
    )


@router.get(
    "/branch/{branch_id}",
    response_model=List[TagResponse],
    summary="List tags on all commits in a branch",
)
def tags_for_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ensure branch belongs to user
    branch = (
        db.query(Commit)
          .filter(
              Commit.branch_id == branch_id,
              Commit.owner_id == current_user.id
          )
          .first()
    )
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found or has no commits")

    return (
        db.query(Tag)
          .join(Commit, Commit.id == Tag.commit_id)
          .filter(
              Commit.branch_id == branch_id,
              Commit.owner_id == current_user.id
          )
          .order_by(Tag.created_at.desc())
          .all()
    )


@router.get(
    "/commits/{tag_name}",
    response_model=List[CommitResponse],
    summary="Get all your commits that have a given tag",
)
def get_commits_by_tag(
    tag_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Commit)
          .join(Tag, Tag.commit_id == Commit.id)
          .filter(
              Tag.name == tag_name,
              Commit.owner_id == current_user.id
          )
          .order_by(Commit.created_at.desc())
          .all()
    )
