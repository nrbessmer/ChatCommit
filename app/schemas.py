# app/schemas.py

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class ConversationContext(BaseModel):
    # Always present, even if empty
    messages: List[str] = Field(default_factory=list)
    canvas_images: List[str] = Field(default_factory=list)
    images: List[str] = Field(default_factory=list)
    source: Optional[str] = None


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


class TagCreate(BaseModel):
    name: str
    commit_id: int


class TagResponse(BaseModel):
    id: int
    name: str
    commit_id: int

    class Config:
        orm_mode = True


class UserRegister(BaseModel):
    full_name: str
    address: str
    email: EmailStr
    company: str
    password: str


class UserRegisterResponse(BaseModel):
    message: str

    class Config:
        orm_mode = True


class UserRead(BaseModel):
    id: int
    full_name: str
    address: str
    email: EmailStr
    company: str
    subscribed: bool
    date_subscribed: Optional[datetime]
    date_subscription_expires: Optional[datetime]

    class Config:
        orm_mode = True


class UserActivate(BaseModel):
    email: EmailStr
    token: str

    class Config:
        orm_mode = True


class UserActivateResponse(BaseModel):
    message: str

    class Config:
        orm_mode = True
