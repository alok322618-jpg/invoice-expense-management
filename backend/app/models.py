import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship

from .database import Base


def _now():
    return datetime.datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    name = Column(String(128), nullable=False)
    role = Column(String(16), nullable=False)
    location = Column(String(128), default="")
    status = Column(String(16), default="active")
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_by = Column(String(64), default="")
    created_at = Column(DateTime, default=_now)


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_no = Column(String(64), unique=True, index=True, nullable=False)
    vendor = Column(String(128), nullable=False)
    amount = Column(Float, nullable=False)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    status = Column(String(24), default="captured", index=True)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text, default="")
    history = Column(JSON, default=list)
    created_at = Column(DateTime, default=_now)

    assignee = relationship("User", foreign_keys=[assignee_id])


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_no = Column(String(64), unique=True, index=True, nullable=False)
    vendor = Column(String(128), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String(24), default="pending_approval", index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text, default="")
    history = Column(JSON, default=list)
    created_at = Column(DateTime, default=_now)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    date = Column(Date, nullable=False)
    location = Column(String(128), default="")
    budget = Column(Float, default=0.0)
    status = Column(String(24), default="planned")
    created_at = Column(DateTime, default=_now)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(Date, nullable=False)
    method = Column(String(32), default="")
    reference_no = Column(String(64), default="")
    status = Column(String(24), default="scheduled", index=True)
    remarks = Column(Text, default="")
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=_now)

    invoice = relationship("Invoice", foreign_keys=[invoice_id])
