from datetime import datetime, timezone  # Add this import!
from fastapi import APIRouter, Depends, HTTPException, status
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot merge a branch into itself"
        )

    # Load source and target, ensuring they belong to the user
    src = (
        db.query(Branch)
          .filter(
              Branch.id == source_branch_id,
              Branch.owner_id == current_user.id,
          )
          .first()
    )
    dst = (
        db.query(Branch)
          .filter(
              Branch.id == target_branch_id,
              Branch.owner_id == current_user.id,
          )
          .first()
    )
    if not src or not dst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both branches not found"
        )

    # Get all commits owned by the user
    all_user_commits = (
        db.query(Commit)
          .filter(Commit.owner_id == current_user.id)
          .all()
    )
    
    # Find commits that should be on the source branch
    # (either they already have the right branch_id or they're part of its ancestry)
    src_commits = []
    for commit in all_user_commits:
        # If it's already marked as being on this branch
        if commit.branch_id == source_branch_id:
            src_commits.append(commit)
        # Otherwise, fix the branch assignment if it's the head commit
        elif commit.id == src.current_commit_id:
            commit.branch_id = source_branch_id
            src_commits.append(commit)
    
    # Gather existing hashes on the destination branch
    dst_hashes = {
        c.commit_hash
        for c in all_user_commits
        if c.branch_id == target_branch_id
    }

    merged = []
    for c in src_commits:
        if c.commit_hash not in dst_hashes:
            new = Commit(
                commit_hash=c.commit_hash,
                commit_message=f"[MERGED] {c.commit_message}",
                conversation_context=c.conversation_context,
                created_at=datetime.now(timezone.utc),  # Add timestamp
                branch_id=target_branch_id,
                parent_commit_id=dst.current_commit_id,
                owner_id=current_user.id,
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
