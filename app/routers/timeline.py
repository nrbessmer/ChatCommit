from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Commit, Tag
from ..schemas import CommitResponse

router = APIRouter(
    prefix="/timeline",          # ⇒ final URL is /timeline/ … (note the trailing “/”)
    tags=["timeline"],
)

@router.get(
    "/",                         #  ⬑  *empty* path component → matches “/timeline/”
    response_model=List[CommitResponse],
    summary="Return commits filtered by branch, tag or date range",
)
def get_timeline(
    db: Session = Depends(get_db),
    branch_id: Optional[int] = Query(None, description="Filter by branch id"),
    tag:       Optional[str] = Query(None, description="Filter by tag"),
    start_date:Optional[datetime] = Query(None, description="ISO start date"),
    end_date:  Optional[datetime] = Query(None, description="ISO end date"),
):
    q = db.query(Commit)

    if branch_id is not None:
        q = q.filter(Commit.branch_id == branch_id)
    if start_date:
        q = q.filter(Commit.created_at >= start_date)
    if end_date:
        q = q.filter(Commit.created_at <= end_date)

    commits = q.order_by(Commit.created_at.desc()).all()

    # post‑filter by tag if requested
    if tag:
        tagged_ids = {
            t.commit_id
            for t in db.query(Tag).filter(Tag.name == tag).all()
        }
        commits = [c for c in commits if c.id in tagged_ids]

    return commits
