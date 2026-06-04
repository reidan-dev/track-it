from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.bill import Bill, BillPayment
from app.schemas.bill import BillCreate, BillUpdate, BillOut

router = APIRouter(prefix="/bills", tags=["bills"])


@router.get("", response_model=list[BillOut])
def list_bills(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Bill).filter(Bill.user_id == current_user.id).all()


@router.post("", response_model=BillOut, status_code=201)
def create_bill(
    data: BillCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bill = Bill(user_id=current_user.id, **data.model_dump())
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


@router.put("/{bill_id}", response_model=BillOut)
def update_bill(
    bill_id: int,
    data: BillUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(bill, field, value)
    db.commit()
    db.refresh(bill)
    return bill


@router.delete("/{bill_id}", status_code=204)
def delete_bill(
    bill_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    db.delete(bill)
    db.commit()


@router.post("/{bill_id}/pay/{month}/{year}", response_model=BillOut)
def pay_bill(
    bill_id: int,
    month: int,
    year: int,
    amount_paid: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bill = db.query(Bill).filter(Bill.id == bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    existing = db.query(BillPayment).filter(
        BillPayment.bill_id == bill_id,
        BillPayment.month == month,
        BillPayment.year == year,
    ).first()
    if existing:
        existing.amount_paid = amount_paid or bill.amount
        db.commit()
        db.refresh(bill)
        return bill
    payment = BillPayment(
        bill_id=bill_id,
        month=month,
        year=year,
        amount_paid=amount_paid or bill.amount,
    )
    db.add(payment)
    db.commit()
    db.refresh(bill)
    return bill
