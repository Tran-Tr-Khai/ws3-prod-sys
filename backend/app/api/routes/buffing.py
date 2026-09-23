from datetime import date
import mimetypes
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.session import get_db
from app.models.buffing import BuffingCheck, BuffingCheckImage
from app.schemas.buffing import BuffingCheckCreate, BuffingCheckResponse, BuffingImageResponse
from app.security.auth import get_current_user

router = APIRouter(prefix="/buffing/checks", tags=["buffing"])
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGES_PER_CHECK = 10
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def media_root() -> Path:
    root = Path(get_settings().media_root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def image_response(image: BuffingCheckImage) -> BuffingImageResponse:
    return BuffingImageResponse(
        id=image.id,
        original_name=image.original_name,
        mime_type=image.mime_type,
        file_size=image.file_size,
        sort_order=image.sort_order,
        is_primary=image.is_primary,
        url=f"/api/buffing/checks/{image.buffing_check_id}/images/{image.id}/file",
    )


def check_response(check: BuffingCheck) -> BuffingCheckResponse:
    return BuffingCheckResponse(
        id=check.id,
        machine_id=check.machine_id,
        check_date=check.check_date,
        checked_at=check.checked_at,
        operator_name=check.operator_name,
        check_1=check.check_1,
        check_2=check.check_2,
        check_3=check.check_3,
        check_4=check.check_4,
        check_5=check.check_5,
        remark=check.remark,
        created_at=check.created_at,
        images=[image_response(image) for image in check.images],
    )


@router.post("", response_model=BuffingCheckResponse, status_code=201)
def create_buffing_check(payload: BuffingCheckCreate, db: Session = Depends(get_db)) -> BuffingCheckResponse:
    check = BuffingCheck(**payload.model_dump())
    db.add(check)
    db.commit()
    db.refresh(check)
    return check_response(check)


@router.get("", response_model=list[BuffingCheckResponse])
def list_buffing_checks(
    check_date: date = Query(...),
    machine_id: str = Query(default="BU-01", min_length=1, max_length=50),
    db: Session = Depends(get_db),
) -> list[BuffingCheckResponse]:
    statement = select(BuffingCheck).where(
        BuffingCheck.machine_id == machine_id,
        BuffingCheck.check_date == check_date,
    ).order_by(desc(BuffingCheck.checked_at), desc(BuffingCheck.id))
    return [check_response(check) for check in db.scalars(statement).all()]


def get_check(check_id: int, db: Session) -> BuffingCheck:
    check = db.get(BuffingCheck, check_id)
    if check is None:
        raise HTTPException(status_code=404, detail="Buffing check not found")
    return check


@router.post("/{check_id}/images", response_model=list[BuffingImageResponse], status_code=status.HTTP_201_CREATED)
async def upload_buffing_images(
    check_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
) -> list[BuffingImageResponse]:
    check = get_check(check_id, db)
    if not files or len(check.images) + len(files) > MAX_IMAGES_PER_CHECK:
        raise HTTPException(status_code=400, detail=f"A Buffing check can contain at most {MAX_IMAGES_PER_CHECK} images")

    root = media_root()
    saved: list[BuffingCheckImage] = []
    try:
        for offset, upload in enumerate(files):
            if upload.content_type not in ALLOWED_IMAGE_TYPES:
                raise HTTPException(status_code=415, detail="Only JPG, PNG and WEBP images are supported")
            content = await upload.read()
            if not content or len(content) > MAX_IMAGE_BYTES:
                raise HTTPException(status_code=413, detail="Each image must be smaller than 5 MB")
            extension = mimetypes.guess_extension(upload.content_type) or ".img"
            relative_path = Path(str(check.id)) / f"{uuid4().hex}{extension}"
            target = root / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            image = BuffingCheckImage(
                buffing_check_id=check.id,
                file_path=str(relative_path),
                original_name=upload.filename or f"buffing-{check.id}-{offset + 1}{extension}",
                mime_type=upload.content_type,
                file_size=len(content),
                sort_order=len(check.images) + offset,
                is_primary=not check.images and offset == 0,
            )
            db.add(image)
            saved.append(image)
        db.commit()
        for image in saved:
            db.refresh(image)
        return [image_response(image) for image in saved]
    except Exception:
        db.rollback()
        for image in saved:
            target = root / image.file_path
            if target.exists():
                target.unlink()
        raise


@router.get("/{check_id}/images/{image_id}/file", response_class=FileResponse)
def get_buffing_image(check_id: int, image_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)) -> FileResponse:
    image = db.scalar(select(BuffingCheckImage).where(BuffingCheckImage.id == image_id, BuffingCheckImage.buffing_check_id == check_id))
    if image is None:
        raise HTTPException(status_code=404, detail="Buffing image not found")
    root = media_root()
    target = (root / image.file_path).resolve()
    if root not in target.parents or not target.is_file():
        raise HTTPException(status_code=404, detail="Buffing image file not found")
    return FileResponse(target, media_type=image.mime_type, filename=image.original_name)


@router.patch("/{check_id}/images/{image_id}/primary", response_model=BuffingImageResponse)
def set_primary_buffing_image(check_id: int, image_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)) -> BuffingImageResponse:
    image = db.scalar(select(BuffingCheckImage).where(BuffingCheckImage.id == image_id, BuffingCheckImage.buffing_check_id == check_id))
    if image is None:
        raise HTTPException(status_code=404, detail="Buffing image not found")
    siblings = db.scalars(select(BuffingCheckImage).where(BuffingCheckImage.buffing_check_id == check_id)).all()
    for sibling in siblings:
        sibling.is_primary = sibling.id == image_id
    db.commit()
    db.refresh(image)
    return image_response(image)
