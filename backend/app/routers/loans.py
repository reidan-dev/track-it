from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.loan import Loan, LoanPayment
from app.schemas.loan import LoanCreate, LoanUpdate, LoanOut, LoanPaymentCreate, LoanPaymentOut

router = APIRouter(prefix="/loans", tags=["loans"])


@router.get("", response_model=list[LoanOut])
def list_loans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Loan).filter(Loan.user_id == current_user.id).all()


@router.post("", response_model=LoanOut, status_code=201)
def create_loan(
    data: LoanCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loan = Loan(user_id=current_user.id, **data.model_dump())
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return loan


@router.put("/{loan_id}", response_model=LoanOut)
def update_loan(
    loan_id: int,
    data: LoanUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == current_user.id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loan, field, value)
    db.commit()
    db.refresh(loan)
    return loan


@router.delete("/{loan_id}", status_code=204)
def delete_loan(
    loan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == current_user.id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    db.delete(loan)
    db.commit()


@router.post("/{loan_id}/payments", response_model=LoanPaymentOut, status_code=201)
def add_loan_payment(
    loan_id: int,
    data: LoanPaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == current_user.id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    payment = LoanPayment(loan_id=loan_id, **data.model_dump())
    db.add(payment)
    loan.terms_paid += 1
    db.commit()
    db.refresh(payment)
    return payment


@router.patch("/{loan_id}/settle", response_model=LoanOut)
def settle_loan(
    loan_id: int,
    final_amount: float = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == current_user.id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if final_amount:
        payment = LoanPayment(loan_id=loan_id, amount=final_amount, note="Final settlement")
        db.add(payment)
    loan.status = "settled"
    db.commit()
    db.refresh(loan)
    return loan
