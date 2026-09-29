from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth as auth_router
from .routers import invoices, misc, payments, purchase_orders, users, vendors
from .seed import seed

Base.metadata.create_all(bind=engine)
seed()

app = FastAPI(title="Invoice & Expense Management API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(purchase_orders.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(vendors.router, prefix="/api")
app.include_router(misc.events_router, prefix="/api")
app.include_router(misc.dash_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True}
