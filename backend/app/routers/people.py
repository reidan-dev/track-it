from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.person import Person
from app.models.loan import Loan
from app.schemas.person import PersonCreate, PersonUpdate, PersonOut, PersonSummaryOut

router = APIRouter(prefix="/people", tags=["people"])


@router.get("", response_model=list[PersonOut])
def list_people(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Person).filter(Person.user_id == current_user.id).all()


@router.post("", response_model=PersonOut, status_code=201)
def create_person(
    data: PersonCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = Person(user_id=current_user.id, **data.model_dump())
    db.add(person)
    db.commit()
    db.refresh(person)
    return person


@router.put("/{person_id}", response_model=PersonOut)
def update_person(
    person_id: int,
    data: PersonUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id, Person.user_id == current_user.id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(person, field, value)
    db.commit()
    db.refresh(person)
    return person


@router.delete("/{person_id}", status_code=204)
def delete_person(
    person_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id, Person.user_id == current_user.id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    db.delete(person)
    db.commit()


@router.get("/{person_id}/summary", response_model=PersonSummaryOut)
def person_summary(
    person_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    person = db.query(Person).filter(Person.id == person_id, Person.user_id == current_user.id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    loans = db.query(Loan).filter(Loan.person_id == person_id, Loan.user_id == current_user.id).all()
    net_balance = Decimal(0)
    active_count = 0
    for loan in loans:
        total_paid = sum(p.amount for p in loan.payments)
        remaining = loan.principal - total_paid
        if loan.direction == "lent":
            net_balance += remaining
        else:
            net_balance -= remaining
        if loan.status == "active":
            active_count += 1
    return PersonSummaryOut(
        **PersonOut.model_validate(person).model_dump(),
        net_balance=net_balance,
        active_loan_count=active_count,
    )
