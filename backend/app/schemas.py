from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime, timedelta
from typing import Optional


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: Optional[str] = Field(default=None, max_length=120)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Пароль должен содержать хотя бы одну цифру")
        if not any(c.isalpha() for c in v):
            raise ValueError("Пароль должен содержать хотя бы одну букву")
        return v


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TableBase(BaseModel):
    name: str
    description: Optional[str] = None
    capacity: int = 2
    location: Optional[str] = None
    is_active: bool = True


class TableCreate(TableBase):
    pass


class TableUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None


class TableOut(TableBase):
    id: int

    class Config:
        from_attributes = True


class BookingCreate(BaseModel):
    table_id: int
    start_time: datetime
    end_time: datetime
    guests_count: int = Field(default=2, ge=1, le=20)
    comment: Optional[str] = Field(default=None, max_length=500)

    @field_validator("start_time")
    @classmethod
    def start_not_in_past(cls, v: datetime) -> datetime:
        if v < datetime.utcnow() - timedelta(minutes=1):
            raise ValueError("Нельзя бронировать в прошлом")
        return v

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, v: datetime, info) -> datetime:
        start = info.data.get("start_time")
        if start and v <= start:
            raise ValueError("Время окончания должно быть позже начала")
        return v


class BookingOut(BaseModel):
    id: int
    user_id: int
    table_id: int
    start_time: datetime
    end_time: datetime
    guests_count: int
    comment: Optional[str] = None
    status: str
    created_at: datetime
    table: Optional[TableOut] = None
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True


class BookingStatusUpdate(BaseModel):
    status: str  