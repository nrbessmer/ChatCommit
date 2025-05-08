# app/routers/timeline.py
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Commit, Tag
from ..schemas import CommitResponse

router = APIRouter(prefix="", tags=["timeline"])

@router.get("/")
def get_timeline(
    db: Session = Depends(get_db),
    branch_id: Optional[int]    = Query(None, description="Branch ID"),
    tag:       Optional[str]    = Query(None, description="Tag name"),
    start_date:Optional[datetime]= Query(None, description="Start"),
    end_date:  Optional[datetime]= Query(None, description="End"),
) -> List[Commit]:
    query = db.query(Commit)
    if branch_id is not None:
        query = query.filter(Commit.branch_id == branch_id)
    if start_date:
        query = query.filter(Commit.created_at >= start_date)
    if end_date:
        query = query.filter(Commit.created_at <= end_date)
    commits = query.order_by(Commit.created_at.desc()).all()
    if tag:
        tagged = {t.commit_id for t in db.query(Tag).filter(Tag.name == tag)}
        commits = [c for c in commits if c.id in tagged]
    return commits
