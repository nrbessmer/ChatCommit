# app/routers/tag.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Tag, Commit
from app.schemas import TagCreate, TagResponse
from typing import List
router = APIRouter()

@router.post("/", response_model=TagResponse)
def create_tag(tag: TagCreate, db: Session = Depends(get_db)):
    existing = db.query(Tag).filter(
        Tag.name == tag.name,
        Tag.commit_id == tag.commit_id
    ).first()
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

@router.get("/", response_model=list[TagResponse])
def list_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.created_at.desc()).all()

@router.get("/commit/{commit_id}", response_model=list[TagResponse])
def tags_for_commit(commit_id: int, db: Session = Depends(get_db)):
    return db.query(Tag).filter(Tag.commit_id == commit_id).all()

