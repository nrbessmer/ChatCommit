from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Commit, Tag
from ..schemas import CommitResponse   # Pydantic model!

router = APIRouter(
    prefix="/timeline",
    tags=["timeline"],
)

# ────────────────────────────────────────────────────────────
# helpers
# ────────────────────────────────────────────────────────────
def _base_query(db: Session,
                branch_id: Optional[int],
                start_date: Optional[datetime],
                end_date: Optional[datetime]):
    q = db.query(Commit)
    if branch_id is not None:
        q = q.filter(Commit.branch_id == branch_id)
    if start_date:
        q = q.filter(Commit.created_at >= start_date)
    if end_date:
        q = q.filter(Commit.created_at <= end_date)
    return q.order_by(Commit.created_at.desc())


# ────────────────────────────────────────────────────────────
# GET /timeline/   (optionally ?branch_id=&tag=&start_date=&end_date=)
# ────────────────────────────────────────────────────────────
@router.get("/", response_model=List[CommitResponse])
def timeline_root(
    db: Session = Depends(get_db),
    branch_id: Optional[int] = Query(None, description="Filter by branch ID"),
    tag: Optional[str]       = Query(None, description="Filter by tag"),
    start_date: Optional[datetime] = Query(
        None, description="ISO start datetime (inclusive)"
    ),
    end_date: Optional[datetime] = Query(
        None, description="ISO end datetime (inclusive)"
    ),
):
    commits = _base_query(db, branch_id, start_date, end_date).all()

    # tag filter (in‑memory for speed & simplicity)
    if tag:
        tagged_ids = {
            t.commit_id for t in db.query(Tag).filter(Tag.name == tag).all()
        }
        commits = [c for c in commits if c.id in tagged_ids]

    return commits


# ────────────────────────────────────────────────────────────
# GET /timeline/{branch_id}
# same logic but branch is mandatory in the path
# ────────────────────────────────────────────────────────────
@router.get("/{branch_id}", response_model=List[CommitResponse])
def timeline_for_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    tag: Optional[str]       = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime]   = Query(None),
):
    # re‑use helper
    return timeline_root(
        db=db,
        branch_id=branch_id,
        tag=tag,
        start_date=start_date,
        end_date=end_date,
    )

