from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Branch, Commit

router = APIRouter()  # no prefix here

@router.post(
    "/merge/{source_branch_id}/{target_branch_id}",
    summary="Merge commits from one branch into another",
)
def merge_branches(
    source_branch_id: int,
    target_branch_id: int,
    db: Session = Depends(get_db),
):
    if source_branch_id == target_branch_id:
        raise HTTPException(400, "Cannot merge a branch into itself")

    src = db.get(Branch, source_branch_id)
    dst = db.get(Branch, target_branch_id)
    if not src or not dst:
        raise HTTPException(404, "One or both branches not found")

    src_commits = db.query(Commit).filter(Commit.branch_id == source_branch_id).all()
    dst_hashes  = {c.commit_hash for c in db.query(Commit).filter(Commit.branch_id == target_branch_id)}

    merged = []
    for c in src_commits:
        if c.commit_hash not in dst_hashes:
            new = Commit(
                commit_hash=c.commit_hash,
                commit_message=f"[MERGED] {c.commit_message}",
                conversation_context=c.conversation_context,
                branch_id=target_branch_id,
                parent_commit_id=dst.current_commit_id,
            )
            db.add(new)
            db.flush()
            dst.current_commit_id = new.id
            merged.append(c.commit_hash)

    db.commit()
    return {
        "message": f"Merged {len(merged)} commits from '{src.name}' → '{dst.name}'",
        "merged_commits": merged,
    }
