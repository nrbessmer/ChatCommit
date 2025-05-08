from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Commit, Tag
from app.schemas import CommitResponse

router = APIRouter()  # no prefix here!

@router.get(
    "/",
    response_model=List[CommitResponse],
    summary="Fetch timeline (with optional filters)",
)
def get_timeline(
    db: Session = Depends(get_db),
    branch_id: Optional[int] = Query(None, description="Filter by branch ID"),
    tag:       Optional[str] = Query(None, description="Filter by tag name"),
    start_date: Optional[datetime] = Query(None, description="Start of date range"),
    end_date:   Optional[datetime] = Query(None, description="End of date range"),
):
    query = db.query(Commit)

    if branch_id is not None:
        query = query.filter(Commit.branch_id == branch_id)
    if start_date:
        query = query.filter(Commit.created_at >= start_date)
    if end_date:
        query = query.filter(Commit.created_at <= end_date)

    commits = query.order_by(Commit.created_at.desc()).all()

    if tag:
        tagged_ids = {t.commit_id for t in db.query(Tag).filter(Tag.name == tag)}
        commits = [c for c in commits if c.id in tagged_ids]

    return commits
