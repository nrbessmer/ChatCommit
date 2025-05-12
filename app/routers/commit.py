# app/routers/commit.py

from datetime import datetime, timezone
import hashlib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Commit, Branch, User
from ..schemas import CommitCreate, CommitResponse
from ..routers.auth import get_current_user

router = APIRouter(
    prefix="/commit",
    tags=["commits"],
    dependencies=[Depends(get_current_user)]
)

@router.get(
    "/",
    response_model=list[CommitResponse],
    summary="List all your commits",
)
def list_commits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Commit]:
    return (
        db.query(Commit)
          .filter(Commit.owner_id == current_user.id)
          .order_by(Commit.created_at.desc())
          .all()
    )

@router.post(
    "/",
    response_model=CommitResponse,
    summary="Create a new commit on a branch",
)
def create_commit(
    commit_in: CommitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Commit:
    # generate a stable-ish hash based on timestamp + message
    sha_input = f"{datetime.now(timezone.utc).isoformat()}-{commit_in.commit_message}"
    commit_hash = hashlib.sha1(sha_input.encode()).hexdigest()

    if db.query(Commit).filter(Commit.commit_hash == commit_hash).first():
        raise HTTPException(400, "Duplicate commit detected.")

    parent_commit_id = None
    branch = None
    if commit_in.branch_id is not None:
        branch = db.get(Branch, commit_in.branch_id)
        if not branch or branch.owner_id != current_user.id:
            raise HTTPException(404, "Branch not found or not yours")
        parent_commit_id = branch.current_commit_id

    db_commit = Commit(
        commit_hash=commit_hash,
        commit_message=commit_in.commit_message,
        conversation_context=commit_in.conversation_context.dict(),
        branch_id=commit_in.branch_id,
        parent_commit_id=parent_commit_id,
        owner_id=current_user.id,
    )
    db.add(db_commit)
    db.commit()
    db.refresh(db_commit)

    # advance the branch head
    if branch:
        branch.current_commit_id = db_commit.id
        db.commit()

    return db_commit

@router.get(
    "/{commit_id}",
    response_model=CommitResponse,
    summary="Fetch one of your commits by ID",
)
def get_commit(
    commit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Commit:
    commit = (
        db.query(Commit)
          .filter(
              Commit.id == commit_id,
              Commit.owner_id == current_user.id
          )
          .first()
    )
    if not commit:
        raise HTTPException(404, "Commit not found")
    return commit
