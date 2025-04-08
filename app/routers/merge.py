from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Branch, Commit
from typing import List

router = APIRouter()

@router.post("/merge/{source_branch_id}/{target_branch_id}")
def merge_branches(source_branch_id: int, target_branch_id: int, db: Session = Depends(get_db)):
    if source_branch_id == target_branch_id:
        raise HTTPException(status_code=400, detail="Cannot merge a branch into itself")
    
    source_branch = db.get(Branch, source_branch_id)
    target_branch = db.get(Branch, target_branch_id)

    if not source_branch or not target_branch:
        raise HTTPException(status_code=404, detail="One or both branches not found")
    
    source_commits = db.query(Commit).filter(Commit.branch_id == source_branch_id).all()
    target_commit_hashes = {
        c.commit_hash for c in db.query(Commit).filter(Commit.branch_id == target_branch_id).all()
    }

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
            db.flush()  # generate ID without commit
            target_branch.current_commit_id = new_commit.id
            merged.append(commit.commit_hash)

    db.commit()

    return {
        "message": f"Merged {len(merged)} commits from '{source_branch.name}' → '{target_branch.name}'",
        "merged_commits": merged
    }
