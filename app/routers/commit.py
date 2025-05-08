# app/routers/commit.py

from datetime import datetime, timezone
import hashlib
from typing import List, Dict, Any

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Commit, Branch, User
from ..schemas import CommitCreate, CommitResponse
from ..config import SECRET_KEY, ALGORITHM  # ensure this reads your ENV secret

router = APIRouter(prefix="/commit", tags=["commits"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get(
    "/",
    response_model=List[CommitResponse],
    summary="List all commits",
)
def list_commits(db: Session = Depends(get_db)) -> List[Commit]:
    return db.query(Commit).order_by(Commit.created_at.desc()).all()


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
        raise HTTPException(status_code=400, detail="Duplicate commit detected.")

    parent_commit_id = None
    branch = None
    if commit_in.branch_id is not None:
        branch = db.query(Branch).get(commit_in.branch_id)
        if not branch:
            raise HTTPException(status_code=404, detail="Branch not found")
        parent_commit_id = branch.current_commit_id

    # store full conversation_context (with messages list)
    ctx_dict: Dict[str, Any] = commit_in.conversation_context.dict()

    db_commit = Commit(
        commit_hash=commit_hash,
        commit_message=commit_in.commit_message,
        conversation_context=ctx_dict,
        branch_id=commit_in.branch_id,
        parent_commit_id=parent_commit_id,
        # assign to the actual column name in your model
        created_by=current_user.id,
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
    summary="Fetch a single commit by ID",
)
def get_commit(commit_id: int, db: Session = Depends(get_db)) -> Commit:
    commit = db.query(Commit).get(commit_id)
    if not commit:
        raise HTTPException(status_code=404, detail="Commit not found")
    return commit
