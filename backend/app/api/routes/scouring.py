from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.scouring import ScouringRecord
from app.models.scouring_inspection import ScouringPhInspection
from app.schemas.scouring import ScouringPhInspectionCreate, ScouringPhInspectionResponse, ScouringRecordCreate, ScouringRecordResponse

router = APIRouter(prefix="/scouring/records", tags=["scouring"])
inspection_router = APIRouter(prefix="/scouring/inspections", tags=["scouring-inspections"])


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


@inspection_router.post("", response_model=ScouringPhInspectionResponse, status_code=status.HTTP_201_CREATED)
def create_scouring_ph_inspection(
    payload: ScouringPhInspectionCreate,
    db: Session = Depends(get_db),
) -> ScouringPhInspection:
    if db.get(ScouringRecord, payload.scouring_record_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scouring operation record was not found")
    tank_values = [getattr(payload, f"tank_{index}_ph") for index in range(8)]
    if not any(value is not None for value in tank_values):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one tank pH value is required")
    inspection = ScouringPhInspection(**payload.model_dump())
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection


@inspection_router.get("", response_model=list[ScouringPhInspectionResponse])
def list_scouring_ph_inspections(
    scouring_record_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[ScouringPhInspection]:
    statement = select(ScouringPhInspection).order_by(desc(ScouringPhInspection.inspected_at), desc(ScouringPhInspection.id)).limit(limit)
    if scouring_record_id is not None:
        statement = statement.where(ScouringPhInspection.scouring_record_id == scouring_record_id)
    return list(db.scalars(statement).all())


@inspection_router.get("/{inspection_id}", response_model=ScouringPhInspectionResponse)
def get_scouring_ph_inspection(inspection_id: int, db: Session = Depends(get_db)) -> ScouringPhInspection:
    inspection = db.get(ScouringPhInspection, inspection_id)
    if inspection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"PH inspection '{inspection_id}' was not found")
    return inspection
