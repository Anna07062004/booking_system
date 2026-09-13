from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from .. import crud, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.post("/", response_model=schemas.BookingOut)
def create_booking(
    data: schemas.BookingCreate,
    db: Session = Depends(get_db),
    current=Depends(auth.get_current_user),
):
    try:
        return crud.create_booking(db, current, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/my", response_model=List[schemas.BookingOut])
def my_bookings(db: Session = Depends(get_db), current=Depends(auth.get_current_user)):
    return crud.list_user_bookings(db, current.id)


@router.get("/", response_model=List[schemas.BookingOut])
def all_bookings(db: Session = Depends(get_db), _admin=Depends(auth.get_current_admin)):
    return crud.list_all_bookings(db)


@router.post("/{booking_id}/cancel", response_model=schemas.BookingOut)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current=Depends(auth.get_current_user),
):
    try:
        return crud.cancel_booking(db, booking_id, current)
    except (ValueError, PermissionError) as e:
        raise HTTPException(400, str(e))


@router.post("/{booking_id}/status", response_model=schemas.BookingOut)
def change_status(
    booking_id: int,
    data: schemas.BookingStatusUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(auth.get_current_admin),
):
    try:
        return crud.update_booking_status(db, booking_id, data.status)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/schedule", response_model=List[schemas.BookingOut])
def schedule(
    date_from: datetime = Query(default_factory=lambda: datetime.utcnow()),
    date_to: datetime = Query(default_factory=lambda: datetime.utcnow() + timedelta(days=7)),
    db: Session = Depends(get_db),
    _admin=Depends(auth.get_current_admin),
):
    return crud.get_schedule(db, date_from, date_to)


# Публичный эндпоинт: слоты занятости по столику на дату
@router.get("/busy/{table_id}")
def busy_slots(table_id: int, date: str, db: Session = Depends(get_db)):
    try:
        day = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Неверный формат даты (YYYY-MM-DD)")
    day_end = day + timedelta(days=1)
    rows = crud.get_schedule(db, day, day_end)
    return [
        {
            "id": b.id,
            "start_time": b.start_time.isoformat(),
            "end_time": b.end_time.isoformat(),
            "status": b.status,
        }
        for b in rows
        if b.table_id == table_id
    ]

@router.get("/busy-all")
def busy_all(date: str, db: Session = Depends(get_db)):
    """Возвращает {busy_table_ids: [...], table_slots: {table_id: [слоты]}} для указанной даты."""
    try:
        day = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Неверный формат даты (YYYY-MM-DD)")

    day_end = day + timedelta(days=1)

    # Все активные брони за этот день
    rows = (
        db.query(models.Booking)
        .filter(
            models.Booking.status.in_(("pending", "confirmed")),
            models.Booking.start_time < day_end,
            models.Booking.end_time > day,
        )
        .all()
    )

    busy_table_ids = list({b.table_id for b in rows})

    table_slots: dict[int, list] = {}
    for b in rows:
        table_slots.setdefault(b.table_id, []).append({
            "id": b.id,
            "start_time": b.start_time.isoformat(),
            "end_time": b.end_time.isoformat(),
            "status": b.status,
        })

    return {
        "date": date,
        "busy_table_ids": busy_table_ids,
        "table_slots": table_slots,
    }