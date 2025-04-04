from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Branch, Commit
from ..schemas import BranchCreate, BranchResponse

router = APIRouter()

@router.post("/", response_model=BranchResponse)
def create_branch(branch: BranchCreate, db: Session = Depends(get_db)):
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


@router.get("/{branch_id}/commits")
def get_commits_for_branch(branch_id: int, db: Session = Depends(get_db)):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    commits = (
        db.query(Commit)
        .filter(Commit.branch_id == branch_id)
        .order_by(Commit.created_at.desc())
        .all()
    )
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
