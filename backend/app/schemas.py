import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    name: str
    role: str
    location: str = ""
    status: str

    class Config:
        from_attributes = True


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    role: str
    location: str = ""


class UserCreateOut(BaseModel):
    user: UserOut
    username: Optional[str] = None
    password: Optional[str] = None
    message: str = ""


class InvoiceCreateIn(BaseModel):
    invoice_no: str
    vendor: str
    amount: float = Field(gt=0)
    invoice_date: datetime.date
    due_date: Optional[datetime.date] = None


class InvoiceOut(BaseModel):
    id: int
    invoice_no: str
    vendor: str
    amount: float
    invoice_date: datetime.date
    due_date: Optional[datetime.date]
    status: str
    assignee_id: Optional[int]
    assignee_name: Optional[str] = None
    remarks: str = ""
    history: List[dict] = []
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class AssignIn(BaseModel):
    assignee_id: int


class VerifyIn(BaseModel):
    decision: str
    remarks: str = ""


class POCreateIn(BaseModel):
    po_no: str
    vendor: str
    amount: float = Field(gt=0)


class POOut(BaseModel):
    id: int
    po_no: str
    vendor: str
    amount: float
    status: str
    remarks: str = ""
    history: List[dict] = []
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class POReviewIn(BaseModel):
    decision: str
    remarks: str = ""


class EventCreateIn(BaseModel):
    name: str
    date: datetime.date
    location: str = ""
    budget: float = 0.0


class EventOut(BaseModel):
    id: int
    name: str
    date: datetime.date
    location: str = ""
    budget: float
    status: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class DashboardOut(BaseModel):
    pending_invoices: int
    delayed_invoices: int
    approved_this_month: int
    total_spend: float
    pending_users: int
    open_pos: int
    total_pending_amount: float = 0.0
    total_paid_amount: float = 0.0
    scheduled_payments: int = 0


class PaymentCreateIn(BaseModel):
    invoice_id: int
    amount: float = Field(gt=0)
    payment_date: datetime.date
    method: str = ""
    reference_no: str = ""
    remarks: str = ""


class PaymentOut(BaseModel):
    id: int
    invoice_id: int
    invoice_no: str = ""
    vendor: str = ""
    amount: float
    payment_date: datetime.date
    method: str = ""
    reference_no: str = ""
    status: str
    remarks: str = ""
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class PayableInvoiceOut(BaseModel):
    id: int
    invoice_no: str
    vendor: str
    amount: float
    remaining: float


class BulkUploadOut(BaseModel):
    added: int
    skipped: List[dict] = []
    total: int = 0
