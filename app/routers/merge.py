# File: app/routers/merge.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Branch, Commit
from typing import List
router = APIRouter()

@router.post("/merge")
def merge_branches(source_branch_id: int, target_branch_id: int, db: Session = Depends(get_db)):
    if source_branch_id == target_branch_id:
        raise HTTPException(status_code=400, detail="Cannot merge a branch into itself")

    source_branch = db.query(Branch).filter_by(id=source_branch_id).first()
    target_branch = db.query(Branch).filter_by(id=target_branch_id).first()

    if not source_branch or not target_branch:
        raise HTTPException(status_code=404, detail="One or both branches not found")

    # Get commits from source branch that are not in target branch
    source_commits = db.query(Commit).filter_by(branch_id=source_branch_id).all()
    target_commit_hashes = {c.commit_hash for c in db.query(Commit).filter_by(branch_id=target_branch_id).all()}

    merged = []
    for commit in source_commits:
        if commit.commit_hash not in target_commit_hashes:
            new_commit = Commit(
                commit_hash=commit.commit_hash,
                commit_message=f"[MERGED] {commit.commit_message}",
                conversation_context=commit.conversation_context,
                branch_id=target_branch_id,
                parent_commit_id=target_branch.current_commit_id
            )
            db.add(new_commit)
            db.commit()
            db.refresh(new_commit)
            target_branch.current_commit_id = new_commit.id
            db.commit()
            merged.append(new_commit.commit_hash)

    return {"message": f"Merged {len(merged)} commits from branch {source_branch.name} into {target_branch.name}.", "merged_commits": merged}

