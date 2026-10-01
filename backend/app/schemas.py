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
    vendor_id: Optional[int] = None
    amount: float = Field(gt=0)
    invoice_date: datetime.date
    due_date: Optional[datetime.date] = None
    event_id: Optional[int] = None


class InvoiceOut(BaseModel):
    id: int
    invoice_no: str
    vendor: str
    vendor_id: Optional[int] = None
    amount: float
    invoice_date: datetime.date
    due_date: Optional[datetime.date]
    status: str
    assignee_id: Optional[int]
    assignee_name: Optional[str] = None
    account_code: str = ""
    coded_by_name: Optional[str] = None
    coded_at: Optional[datetime.datetime] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    attachment: str = ""
    event_id: Optional[int] = None
    event_name: Optional[str] = None
    remarks: str = ""
    history: List[dict] = []
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class AssignIn(BaseModel):
    assignee_id: int


class EventLinkIn(BaseModel):
    event_id: Optional[int] = None


class VerifyIn(BaseModel):
    decision: str
    remarks: str = ""


class CodeIn(BaseModel):
    account_code: str
    remarks: str = ""


class VendorCreateIn(BaseModel):
    name: str
    contact_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    bank_name: str = ""
    account_no: str = ""
    ifsc: str = ""
    address: str = ""


class VendorUpdateIn(BaseModel):
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    bank_name: Optional[str] = None
    account_no: Optional[str] = None
    ifsc: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None


class VendorOut(BaseModel):
    id: int
    name: str
    contact_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    bank_name: str = ""
    account_no: str = ""
    ifsc: str = ""
    address: str = ""
    status: str
    invoice_count: int = 0
    created_at: datetime.datetime

    class Config:
        from_attributes = True


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
    vendor_id: Optional[int] = None


class EventUpdateIn(BaseModel):
    name: Optional[str] = None
    date: Optional[datetime.date] = None
    location: Optional[str] = None
    budget: Optional[float] = None
    status: Optional[str] = None
    vendor_id: Optional[int] = None


class EventOut(BaseModel):
    id: int
    name: str
    date: datetime.date
    location: str = ""
    budget: float
    status: str
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    invoice_count: int = 0
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class AccountCodeCreateIn(BaseModel):
    code: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=128)


class AccountCodeUpdateIn(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None


class AccountCodeOut(BaseModel):
    id: int
    code: str
    name: str
    status: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class EmployeeStatOut(BaseModel):
    user_id: int
    name: str
    role: str
    total: int = 0
    pending: int = 0
    approved: int = 0
    rejected: int = 0
    total_amount: float = 0.0


class VendorStatOut(BaseModel):
    vendor_id: int
    name: str
    invoice_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    approved_amount: float = 0.0
    paid_amount: float = 0.0


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
    vendors: int = 0


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
    bank_name: str = ""
    account_no: str = ""
    ifsc: str = ""
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
    bank_name: str = ""
    account_no: str = ""
    ifsc: str = ""
    amount: float
    remaining: float


class BulkUploadOut(BaseModel):
    added: int
    skipped: List[dict] = []
    total: int = 0
