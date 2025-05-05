# app/routers/tag.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Tag, Commit
from app.schemas import TagCreate, TagResponse, CommitResponse
from typing import List

router = APIRouter()

@router.post("/", response_model=TagResponse)
def create_tag(tag: TagCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(Tag)
          .filter(Tag.name == tag.name, Tag.commit_id == tag.commit_id)
          .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Tag already exists for this commit")

    commit = db.query(Commit).filter(Commit.id == tag.commit_id).first()
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found")

    new_tag = Tag(name=tag.name, commit_id=tag.commit_id)
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    return new_tag

@router.get("/", response_model=List[TagResponse])
def list_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.created_at.desc()).all()

@router.get("/commit/{commit_id}", response_model=List[TagResponse])
def tags_for_commit(commit_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Tag)
          .filter(Tag.commit_id == commit_id)
          .order_by(Tag.created_at.desc())
          .all()
    )

@router.get("/branch/{branch_id}", response_model=List[TagResponse])
def tags_for_branch(branch_id: int, db: Session = Depends(get_db)):
    return (
        db.query(Tag)
          .join(Commit, Commit.id == Tag.commit_id)
          .filter(Commit.branch_id == branch_id)
          .order_by(Tag.created_at.desc())
          .all()
    )

@router.get("/tag/commits/{tag_name}", response_model=List[CommitResponse])
def get_commits_by_tag(tag_name: str, db: Session = Depends(get_db)):
    """
    Return all commits that have this tag.
    """
    commits = (
        db.query(Commit)
          .join(Tag, Tag.commit_id == Commit.id)
          .filter(Tag.name == tag_name)
          .order_by(Commit.created_at.desc())
          .all()
    )
    return commits
