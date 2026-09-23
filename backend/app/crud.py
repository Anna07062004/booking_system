from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
from . import models, schemas, auth


def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, data: schemas.UserCreate, role: str = "client"):
    user = models.User(
        username=data.username,
        email=data.email,
        hashed_password=auth.hash_password(data.password),
        full_name=data.full_name,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_tables(db: Session, only_active: bool = False):
    q = db.query(models.RestaurantTable)
    if only_active:
        q = q.filter(models.RestaurantTable.is_active == True)
    return q.order_by(models.RestaurantTable.id).all()


def get_table(db: Session, table_id: int):
    return db.query(models.RestaurantTable).filter(models.RestaurantTable.id == table_id).first()


def create_table(db: Session, data: schemas.TableCreate):
    t = models.RestaurantTable(**data.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def update_table(db: Session, table_id: int, data: schemas.TableUpdate):
    t = get_table(db, table_id)
    if not t:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


def delete_table(db: Session, table_id: int):
    t = get_table(db, table_id)
    if not t:
        return False
    db.delete(t)
    db.commit()
    return True


ACTIVE_STATUSES = ("pending", "confirmed")


def find_conflicts(
    db: Session, table_id: int, start: datetime, end: datetime,
    exclude_booking_id: int | None = None,
):
    q = db.query(models.Booking).filter(
        models.Booking.table_id == table_id,
        models.Booking.status.in_(ACTIVE_STATUSES),
        models.Booking.start_time < end,
        models.Booking.end_time > start,
    )
    if exclude_booking_id:
        q = q.filter(models.Booking.id != exclude_booking_id)
    return q.all()


def create_booking(db: Session, user: models.User, data: schemas.BookingCreate):
    if data.end_time <= data.start_time:
        raise ValueError("Время окончания должно быть позже времени начала")

    table = get_table(db, data.table_id)
    if not table or not table.is_active:
        raise ValueError("Столик не найден или недоступен")

    conflicts = find_conflicts(db, data.table_id, data.start_time, data.end_time)
    if conflicts:
        raise ValueError("Этот столик уже занят в выбранное время")

    booking = models.Booking(
        user_id=user.id,
        table_id=data.table_id,
        start_time=data.start_time,
        end_time=data.end_time,
        guests_count=data.guests_count,
        comment=data.comment,
        status="pending",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def list_user_bookings(db: Session, user_id: int):
    return (
        db.query(models.Booking)
        .filter(models.Booking.user_id == user_id)
        .order_by(models.Booking.start_time.desc())
        .all()
    )


def list_all_bookings(db: Session):
    return db.query(models.Booking).order_by(models.Booking.start_time.desc()).all()


def get_booking(db: Session, booking_id: int):
    return db.query(models.Booking).filter(models.Booking.id == booking_id).first()


def cancel_booking(db: Session, booking_id: int, user: models.User):
    b = get_booking(db, booking_id)
    if not b:
        raise ValueError("Бронь не найдена")
    if b.user_id != user.id and user.role != "admin":
        raise PermissionError("Нет прав на отмену этой брони")
    if b.status in ("cancelled", "rejected"):
        raise ValueError("Бронь уже отменена/отклонена")
    b.status = "cancelled"
    db.commit()
    db.refresh(b)
    return b


def update_booking_status(db: Session, booking_id: int, status: str):
    if status not in ("pending", "confirmed", "rejected", "cancelled"):
        raise ValueError("Недопустимый статус")

    b = get_booking(db, booking_id)
    if not b:
        raise ValueError("Бронь не найдена")

    if status == "confirmed":
        conflicts = find_conflicts(
            db, b.table_id, b.start_time, b.end_time, exclude_booking_id=b.id
        )
        if conflicts:
            raise ValueError("Нельзя подтвердить: слот уже занят другой бронью")

    b.status = status
    db.commit()
    db.refresh(b)
    return b


def get_schedule(db: Session, date_from: datetime, date_to: datetime):
    return (
        db.query(models.Booking)
        .filter(
            models.Booking.start_time < date_to,
            models.Booking.end_time > date_from,
            models.Booking.status.in_(ACTIVE_STATUSES),
        )
        .all()
    )

def get_busy_table_ids(db: Session, date_from: datetime, date_to: datetime) -> set[int]:
    rows = (
        db.query(models.Booking.table_id)
        .filter(
            models.Booking.status.in_(ACTIVE_STATUSES),
            models.Booking.start_time < date_to,
            models.Booking.end_time > date_from,
        )
        .distinct()
        .all()
    )
    return {r[0] for r in rows}