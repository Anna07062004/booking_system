from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _admin=Depends(auth.get_current_admin)):
    return db.query(models.User).order_by(models.User.id).all()


@router.post("/{user_id}/toggle")
def toggle_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_admin),
):
    if user_id == current.id:
        raise HTTPException(400, "Нельзя заблокировать себя")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    if user.is_active and user.role == "admin":
        admins_left = (
            db.query(models.User)
            .filter(models.User.role == "admin", models.User.is_active == True)
            .count()
        )
        if admins_left <= 1:
            raise HTTPException(400, "Нельзя заблокировать последнего администратора")

    user.is_active = not user.is_active
    db.commit()
    return {"ok": True, "is_active": user.is_active}


@router.post("/{user_id}/role")
def set_role(
    user_id: int,
    role: str,
    db: Session = Depends(get_db),
    current: models.User = Depends(auth.get_current_admin),
):
    if role not in ("client", "admin"):
        raise HTTPException(400, "Недопустимая роль")

    if user_id == current.id and role != "admin":
        raise HTTPException(400, "Нельзя снять с себя роль администратора")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    user.role = role
    db.commit()
    return {"ok": True, "role": user.role}