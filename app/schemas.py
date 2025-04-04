#File: app/schemas.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ConversationContext(BaseModel):
    messages: List[str]

class CommitCreate(BaseModel):
    commit_message: str
    conversation_context: ConversationContext
    branch_id: Optional[int] = None

class CommitResponse(BaseModel):
    id: int
    commit_hash: str
    commit_message: str
    conversation_context: ConversationContext
    created_at: datetime
    branch_id: Optional[int]

    class Config:
        orm_mode = True

class BranchCreate(BaseModel):
    name: str
    base_commit_id: Optional[int] = None

class BranchResponse(BaseModel):
    id: int
    name: str
    current_commit_id: Optional[int]

    class Config:
        orm_mode = True
        
# app/schemas.py

from pydantic import BaseModel
from datetime import datetime

class TagCreate(BaseModel):
    name: str
    commit_id: int

class TagResponse(TagCreate):
    id: int

    class Config:
        from_attributes = True
