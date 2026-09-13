from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None


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
    guests_count: int = 2
    comment: Optional[str] = None


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