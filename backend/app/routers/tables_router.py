from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import crud, models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/tables", tags=["tables"])


@router.get("/", response_model=List[schemas.TableOut])
def list_tables(only_active: bool = False, db: Session = Depends(get_db)):
    return crud.list_tables(db, only_active=only_active)


@router.post("/", response_model=schemas.TableOut)
def create_table(
    data: schemas.TableCreate,
    db: Session = Depends(get_db),
    _admin=Depends(auth.get_current_admin),
):
    return crud.create_table(db, data)


@router.put("/{table_id}", response_model=schemas.TableOut)
def update_table(
    table_id: int,
    data: schemas.TableUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(auth.get_current_admin),
):
    t = crud.update_table(db, table_id, data)
    if not t:
        raise HTTPException(404, "Столик не найден")
    return t


@router.delete("/{table_id}")
def delete_table(
    table_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(auth.get_current_admin),
):
    has_bookings = (
        db.query(models.Booking)
        .filter(
            models.Booking.table_id == table_id,
            models.Booking.status.in_(("pending", "confirmed")),
        )
        .first()
    )
    if has_bookings:
        raise HTTPException(
            400,
            "Нельзя удалить столик: на него есть активные брони. "
            "Сначала отмените или завершите их.",
        )

    if not crud.delete_table(db, table_id):
        raise HTTPException(404, "Столик не найден")
    return {"ok": True}