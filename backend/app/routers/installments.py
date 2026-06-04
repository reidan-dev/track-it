from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.installment import Installment, InstallmentPayment
from app.schemas.installment import InstallmentCreate, InstallmentUpdate, InstallmentOut

router = APIRouter(prefix="/installments", tags=["installments"])


@router.get("", response_model=list[InstallmentOut])
def list_installments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Installment).filter(Installment.user_id == current_user.id).all()


@router.post("", response_model=InstallmentOut, status_code=201)
def create_installment(
    data: InstallmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = Installment(user_id=current_user.id, **data.model_dump())
    db.add(inst)
    db.commit()
    db.refresh(inst)
    return inst


@router.put("/{inst_id}", response_model=InstallmentOut)
def update_installment(
    inst_id: int,
    data: InstallmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(Installment).filter(Installment.id == inst_id, Installment.user_id == current_user.id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Installment not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(inst, field, value)
    db.commit()
    db.refresh(inst)
    return inst


@router.delete("/{inst_id}", status_code=204)
def delete_installment(
    inst_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(Installment).filter(Installment.id == inst_id, Installment.user_id == current_user.id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Installment not found")
    db.delete(inst)
    db.commit()


@router.post("/{inst_id}/pay/{month}/{year}", response_model=InstallmentOut)
def pay_installment(
    inst_id: int,
    month: int,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inst = db.query(Installment).filter(Installment.id == inst_id, Installment.user_id == current_user.id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Installment not found")
    existing = db.query(InstallmentPayment).filter(
        InstallmentPayment.installment_id == inst_id,
        InstallmentPayment.month == month,
        InstallmentPayment.year == year,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already paid for this period")
    payment = InstallmentPayment(installment_id=inst_id, month=month, year=year)
    db.add(payment)
    inst.terms_paid += 1
    if inst.terms_paid >= inst.total_terms:
        inst.status = "completed"
    db.commit()
    db.refresh(inst)
    return inst
