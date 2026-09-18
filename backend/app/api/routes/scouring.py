from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.scouring import ScouringRecord
from app.schemas.scouring import ScouringRecordCreate, ScouringRecordResponse

router = APIRouter(prefix="/scouring/records", tags=["scouring"])


def _get_record_or_404(record_id: int, db: Session) -> ScouringRecord:
    record = db.get(ScouringRecord, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scouring record '{record_id}' was not found",
        )
    return record


@router.post("", response_model=ScouringRecordResponse, status_code=status.HTTP_201_CREATED)
def create_scouring_record(
    payload: ScouringRecordCreate,
    db: Session = Depends(get_db),
) -> ScouringRecord:
    record = ScouringRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("", response_model=list[ScouringRecordResponse])
def list_scouring_records(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[ScouringRecord]:
    statement = (
        select(ScouringRecord)
        .order_by(desc(ScouringRecord.recorded_at), desc(ScouringRecord.id))
        .limit(limit)
    )
    return list(db.scalars(statement).all())


@router.get("/latest", response_model=ScouringRecordResponse)
def get_latest_scouring_record(db: Session = Depends(get_db)) -> ScouringRecord:
    record = db.scalars(
        select(ScouringRecord)
        .order_by(desc(ScouringRecord.recorded_at), desc(ScouringRecord.id))
        .limit(1)
    ).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Scouring records were found",
        )
    return record


@router.get("/{record_id}", response_model=ScouringRecordResponse)
def get_scouring_record(record_id: int, db: Session = Depends(get_db)) -> ScouringRecord:
    return _get_record_or_404(record_id, db)
