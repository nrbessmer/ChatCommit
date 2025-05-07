from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, List
from ..database import get_db
from ..models import Commit, Branch, Tag
from ..schemas import CommitResponse
from datetime import datetime
from app.routers.auth import oauth2_scheme

router = APIRouter()

@router.get("/timeline", response_model=List[CommitResponse])
def get_timeline(
    db: Session = Depends(get_db),
    branch_id: Optional[int] = Query(None),
    tag: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
):
    query = db.query(Commit)

    if branch_id:
        query = query.filter(Commit.branch_id == branch_id)

    if start_date:
        query = query.filter(Commit.created_at >= start_date)
    if end_date:
        query = query.filter(Commit.created_at <= end_date)

    commits = query.order_by(Commit.created_at.desc()).all()

    # If tag filtering is requested, apply it in-memory after fetching
    if tag:
        tagged_commit_ids = {
            t.commit_id for t in db.query(Tag).filter(Tag.name == tag).all()
        }
        commits = [c for c in commits if c.id in tagged_commit_ids]

    return commits
    
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
