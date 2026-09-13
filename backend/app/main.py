from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .database import Base, engine, SessionLocal
from . import models, crud, schemas, auth
from .routers import auth_router, tables_router, bookings_router, users_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Restaurant Booking API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(tables_router.router)
app.include_router(bookings_router.router)
app.include_router(users_router.router)


@app.on_event("startup")
def seed():
    db = SessionLocal()
    try:
        if not crud.get_user_by_username(db, "admin"):
            crud.create_user(
                db,
                schemas.UserCreate(
                    username="admin",
                    email="admin@example.com",
                    password="admin123",
                    full_name="Администратор",
                ),
                role="admin",
            )

        if not crud.list_tables(db):
            demo = [
                schemas.TableCreate(name="Столик №1", description="У окна", capacity=2, location="Основной зал"),
                schemas.TableCreate(name="Столик №2", description="Центральный", capacity=4, location="Основной зал"),
                schemas.TableCreate(name="Столик №3", description="VIP-зона", capacity=6, location="VIP"),
                schemas.TableCreate(name="Терраса №1", description="На веранде", capacity=4, location="Терраса"),
            ]
            for t in demo:
                crud.create_table(db, t)
    finally:
        db.close()


FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend"
)

if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    def page_index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/login.html")
    def page_login():
        return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))

    @app.get("/register.html")
    def page_register():
        return FileResponse(os.path.join(FRONTEND_DIR, "register.html"))

    @app.get("/dashboard.html")
    def page_dashboard():
        return FileResponse(os.path.join(FRONTEND_DIR, "dashboard.html"))

    @app.get("/admin.html")
    def page_admin():
        return FileResponse(os.path.join(FRONTEND_DIR, "admin.html"))