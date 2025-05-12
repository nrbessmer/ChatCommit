# app/routers/timeline.py

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Commit, Tag, User
from ..schemas import CommitResponse
from ..routers.auth import get_current_user

router = APIRouter(
    prefix="/timeline",
    tags=["timeline"],
    dependencies=[Depends(get_current_user)]
)


@router.get(
    "/",
    response_model=List[CommitResponse],
    summary="Return commits filtered by branch, tag or date range",
)
def get_timeline(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    branch_id: Optional[int] = Query(None, description="Filter by branch id"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    start_date: Optional[datetime] = Query(None, description="Start of date range"),
    end_date: Optional[datetime] = Query(None, description="End of date range"),
) -> List[CommitResponse]:
    # 1) Only the current user’s commits
    query = db.query(Commit).filter(Commit.owner_id == current_user.id)

    # 2) Optional branch/date filters
    if branch_id is not None:
        query = query.filter(Commit.branch_id == branch_id)
    if start_date:
        query = query.filter(Commit.created_at >= start_date)
    if end_date:
        query = query.filter(Commit.created_at <= end_date)

    commits = query.order_by(Commit.created_at.desc()).all()

    # 3) Optional tag filter (only this user’s tags)
    if tag:
        tagged_ids = {
            t.commit_id
            for t in (
                db.query(Tag)
                  .join(Commit, Commit.id == Tag.commit_id)
                  .filter(
                      Tag.name == tag,
                      Commit.owner_id == current_user.id
                  )
                  .all()
            )
        }
        commits = [c for c in commits if c.id in tagged_ids]

    return commits
