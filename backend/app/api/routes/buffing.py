from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.buffing import BuffingCheck
from app.schemas.buffing import BuffingCheckCreate, BuffingCheckResponse

router = APIRouter(prefix="/buffing/checks", tags=["buffing"])


@router.post("", response_model=BuffingCheckResponse, status_code=201)
def create_buffing_check(payload: BuffingCheckCreate, db: Session = Depends(get_db)) -> BuffingCheck:
    check = BuffingCheck(**payload.model_dump())
    db.add(check)
    db.commit()
    db.refresh(check)
    return check


@router.get("", response_model=list[BuffingCheckResponse])
def list_buffing_checks(
    check_date: date = Query(...),
    machine_id: str = Query(default="BU-01", min_length=1, max_length=50),
    db: Session = Depends(get_db),
) -> list[BuffingCheck]:
    statement = select(BuffingCheck).where(
        BuffingCheck.machine_id == machine_id,
        BuffingCheck.check_date == check_date,
    ).order_by(desc(BuffingCheck.checked_at), desc(BuffingCheck.id))
    return list(db.scalars(statement).all())
