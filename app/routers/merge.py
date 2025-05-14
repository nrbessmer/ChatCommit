# app/routers/merge.py

from datetime import datetime, timezone
import uuid
import hashlib

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Branch, Commit, User
from ..routers.auth import get_current_user

router = APIRouter(
    prefix="/merge",
    tags=["merge"],
    dependencies=[Depends(get_current_user)],
)

@router.post(
    "/{source_branch_id}/{target_branch_id}",
    summary="Merge commits from one branch into another",
    status_code=status.HTTP_200_OK,
)
def merge_branches(
    source_branch_id: int,
    target_branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if source_branch_id == target_branch_id:
        raise HTTPException(status_code=400, detail="Cannot merge a branch into itself")

    # 1) Load the two branches and verify ownership
    src = db.query(Branch).filter(
        Branch.id == source_branch_id,
        Branch.owner_id == current_user.id,
    ).first()
    dst = db.query(Branch).filter(
        Branch.id == target_branch_id,
        Branch.owner_id == current_user.id,
    ).first()
    if not src or not dst:
        raise HTTPException(status_code=404, detail="One or both branches not found")

    # 2) Gather all your commits once
    all_commits = (
        db.query(Commit)
          .filter(Commit.owner_id == current_user.id)
          .all()
    )

    # 3) Identify which commits “belong” to src by branch_id or ancestry
    src_commits = []
    seen_ids = set()
    for c in all_commits:
        if c.branch_id == source_branch_id or c.id == src.current_commit_id:
            if c.id not in seen_ids:
                # ensure the head commit is marked correctly
                if c.id == src.current_commit_id and c.branch_id != source_branch_id:
                    c.branch_id = source_branch_id
                src_commits.append(c)
                seen_ids.add(c.id)

    # 4) Build a set of original hashes already on dst
    existing_hashes = {
        c.commit_hash
        for c in all_commits
        if c.branch_id == target_branch_id
    }

    merged_hashes = []
    for original in src_commits:
        # skip if original commit was already pulled into dst
        if original.commit_hash in existing_hashes:
            continue

        # build a unique hash for the merged commit
        salt = uuid.uuid4().hex
        sha_input = (
            f"{datetime.now(timezone.utc).isoformat()}"
            f"-MERGE-{original.commit_hash}"
            f"-{salt}"
        )
        new_hash = hashlib.sha1(sha_input.encode()).hexdigest()

        new_commit = Commit(
            commit_hash=new_hash,
            commit_message=f"[MERGED] {original.commit_message}",
            conversation_context=original.conversation_context,
            created_at=datetime.now(timezone.utc),
            branch_id=target_branch_id,
            parent_commit_id=dst.current_commit_id,
            owner_id=current_user.id,
        )
        db.add(new_commit)

        try:
            db.flush()   # attempt INSERT
        except IntegrityError:
            db.rollback()  # skip duplicates (extremely unlikely with uuid4)
            continue

        # advance the destination branch head
        dst.current_commit_id = new_commit.id
        merged_hashes.append(new_hash)

    # finally persist everything
    db.commit()

    return {
        "message": f"Merged {len(merged_hashes)} commit(s) "
                   f"from '{src.name}' → '{dst.name}'",
        "merged_commits": merged_hashes,
    }
