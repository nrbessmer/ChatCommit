from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, UniqueConstraint
from datetime import datetime, timezone
from sqlalchemy.orm import relationship
from .database import Base
from sqlalchemy.sql import func

class Commit(Base):
    __tablename__ = "commits"

    id = Column(Integer, primary_key=True, index=True)
    commit_hash = Column(String, unique=True, index=True)
    commit_message = Column(String)
    conversation_context = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    branch_id = Column(Integer, ForeignKey("branches.id"))
    parent_commit_id = Column(Integer, ForeignKey("commits.id"), nullable=True)

    branch = relationship("Branch", back_populates="commits", foreign_keys=[branch_id])
    parent_commit = relationship("Commit", remote_side=[id], foreign_keys=[parent_commit_id])

class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    current_commit_id = Column(Integer, ForeignKey("commits.id"))

    commits = relationship("Commit", back_populates="branch", foreign_keys="Commit.branch_id")

# app/models.py

class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint('name', 'commit_id', name='_tag_commit_uc'),)

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    commit_id = Column(Integer, ForeignKey("commits.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    commit = relationship("Commit")
