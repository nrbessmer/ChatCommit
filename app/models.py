# app/models.py

from sqlalchemy import (
    Column, Integer, String, DateTime, JSON,
    ForeignKey, UniqueConstraint, Boolean
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Commit(Base):
    __tablename__ = "commits"

    id                  = Column(Integer, primary_key=True, index=True)
    commit_hash         = Column(String, unique=True, index=True)
    commit_message      = Column(String)
    conversation_context= Column(JSON)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    branch_id           = Column(Integer, ForeignKey("branches.id"))
    owner_id            = Column(Integer, ForeignKey("users.id"), nullable=True)
    parent_commit_id    = Column(Integer, ForeignKey("commits.id"), nullable=True)

    branch              = relationship("Branch", back_populates="commits", foreign_keys=[branch_id])
    owner               = relationship("User", back_populates="commits")
    parent_commit       = relationship("Commit", remote_side=[id], foreign_keys=[parent_commit_id])


class Branch(Base):
    __tablename__ = "branches"

    id                  = Column(Integer, primary_key=True, index=True)
    name                = Column(String, unique=True)
    current_commit_id   = Column(Integer, ForeignKey("commits.id"))

    commits             = relationship("Commit", back_populates="branch", foreign_keys=[Commit.branch_id])


class Tag(Base):
    __tablename__ = "tags"
    __table_args__      = (UniqueConstraint('name', 'commit_id', name='_tag_commit_uc'),)

    id                  = Column(Integer, primary_key=True, index=True)
    name                = Column(String, nullable=False)
    commit_id           = Column(Integer, ForeignKey("commits.id"), nullable=False)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    commit              = relationship("Commit")


class User(Base):
    __tablename__ = "users"

    id                          = Column(Integer, primary_key=True, index=True)
    full_name                   = Column(String, nullable=False)
    address                     = Column(String, nullable=False)
    email                       = Column(String, unique=True, index=True, nullable=False)
    company                     = Column(String, nullable=False)
    password_hash               = Column(String, nullable=False)
    token                       = Column(String, unique=True, index=True, nullable=False)
    subscribed                  = Column(Boolean, default=False)
    date_subscribed             = Column(DateTime(timezone=True), nullable=True)
    date_subscription_expires   = Column(DateTime(timezone=True), nullable=True)

    commits                     = relationship("Commit", back_populates="owner")
    stripe_customer_id = Column(String, nullable=True)
