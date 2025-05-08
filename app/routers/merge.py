from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Branch, Commit

router = APIRouter(prefix="/merge", tags=["merge"])


def _do_merge(source_branch: Branch,
              target_branch: Branch,
              db: Session) -> List[str]:
    """Returns list of commit hashes merged."""
    source_commits = db.query(Commit).filter(
        Commit.branch_id == source_branch.id
    ).all()
    existing = {
        c.commit_hash
        for c in db.query(Commit).filter(
            Commit.branch_id == target_branch.id
        ).all()
    }

    merged_hashes: List[str] = []

    for commit in source_commits:
        if commit.commit_hash in existing:
            continue

        clone = Commit(
            commit_hash=commit.commit_hash,
            commit_message=f"[MERGED] {commit.commit_message}",
            conversation_context=commit.conversation_context,
            branch_id=target_branch.id,
            parent_commit_id=target_branch.current_commit_id,
        )
        db.add(clone)
        db.flush()                       # assign ID
        target_branch.current_commit_id = clone.id
        merged_hashes.append(commit.commit_hash)

    db.commit()
    return merged_hashes


# ────────────────────────────────────────────────────────────
# POST /merge/   (expects ?source_branch_id=&target_branch_id= )
# ────────────────────────────────────────────────────────────
@router.post("/")
def merge_query_params(
    source_branch_id: int = Query(..., alias="source_branch_id"),
    target_branch_id: int = Query(..., alias="target_branch_id"),
    db: Session = Depends(get_db),
):
    return merge_branches(source_branch_id, target_branch_id, db)


# ────────────────────────────────────────────────────────────
# POST /merge/{source_branch_id}/{target_branch_id}
# ────────────────────────────────────────────────────────────
@router.post("/{source_branch_id}/{target_branch_id}")
def merge_branches(
    source_branch_id: int,
    target_branch_id: int,
    db: Session = Depends(get_db),
):
    if source_branch_id == target_branch_id:
        raise HTTPException(
            status_code=400, detail="Cannot merge a branch into itself"
        )

    source_branch = db.get(Branch, source_branch_id)
    target_branch = db.get(Branch, target_branch_id)

    if not source_branch or not target_branch:
        raise HTTPException(
            status_code=404, detail="One or both branches not found"
        )

    merged = _do_merge(source_branch, target_branch, db)

    return {
        "message": (
            f"Merged {len(merged)} commits "
            f"from '{source_branch.name}' → '{target_branch.name}'"
        ),
        "merged_commits": merged,
    }
