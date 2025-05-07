from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Branch, Commit, User
from ..schemas import BranchCreate, BranchResponse, CommitResponse
from app.routers.auth import oauth2_scheme, SECRET_KEY, ALGORITHM
import jwt
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/branch", tags=["branch"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

@router.post("/", response_model=BranchResponse)
def create_branch(branch: BranchCreate, db: Session = Depends(get_db)):
    if branch.base_commit_id is not None:
        base_commit = db.query(Commit).filter(Commit.id == branch.base_commit_id).first()
        if not base_commit:
            raise HTTPException(status_code=404, detail="Base commit not found")

    db_branch = Branch(
        name=branch.name,
        current_commit_id=branch.base_commit_id
    )
    db.add(db_branch)
    db.commit()
    db.refresh(db_branch)
    return db_branch


@router.get("/", response_model=list[BranchResponse])
def list_branches(db: Session = Depends(get_db)):
    return db.query(Branch).all()


@router.get("/{branch_id}/commits", response_model=list[CommitResponse])
def get_commits_for_branch(branch_id: int, db: Session = Depends(get_db)):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Walk the parent chain from the branch's current head
    commits: list[Commit] = []
    current_id = branch.current_commit_id
    while current_id:
        commit = db.query(Commit).filter(Commit.id == current_id).first()
        if not commit:
            break
        commits.append(commit)
        current_id = commit.parent_commit_id

    return commits


@router.get("/{branch_id}/head")
def get_branch_head(branch_id: int, db: Session = Depends(get_db)):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    commit = db.query(Commit).filter(Commit.id == branch.current_commit_id).first()
    return {
        "branch": branch.name,
        "head_commit": commit
    }


@router.get("/{branch_id}")
def get_branch(branch_id: int, db: Session = Depends(get_db)):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"id": branch.id, "name": branch.name}


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
