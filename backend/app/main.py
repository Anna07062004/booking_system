import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import get_settings
from .database import Base, engine, SessionLocal
from .logging_config import setup_logging, logger
from .exceptions import register_exception_handlers
from . import crud, schemas
from .routers import auth_router, tables_router, bookings_router, users_router

setup_logging()
settings = get_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Restaurant Booking API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth_router.router)
app.include_router(tables_router.router)
app.include_router(bookings_router.router)
app.include_router(users_router.router)


@app.on_event("startup")
def seed():
    """Создаём админа и несколько столиков при первом запуске.

    Пароль админа берётся из .env. Если пользователь admin уже существует —
    ничего не пересоздаём.
    """
    db = SessionLocal()
    try:
        if not crud.get_user_by_username(db, settings.ADMIN_USERNAME):
            crud.create_user(
                db,
                schemas.UserCreate(
                    username=settings.ADMIN_USERNAME,
                    email=settings.ADMIN_EMAIL,
                    password=settings.ADMIN_PASSWORD,
                    full_name="Администратор",
                ),
                role="admin",
            )
            logger.info("Создан администратор '%s'", settings.ADMIN_USERNAME)

        if not crud.list_tables(db):
            demo = [
                schemas.TableCreate(name="Столик №1", description="У окна", capacity=2, location="Основной зал"),
                schemas.TableCreate(name="Столик №2", description="Центральный", capacity=4, location="Основной зал"),
                schemas.TableCreate(name="Столик №3", description="VIP-зона", capacity=6, location="VIP"),
                schemas.TableCreate(name="Терраса №1", description="На веранде", capacity=4, location="Терраса"),
            ]
            for t in demo:
                crud.create_table(db, t)
            logger.info("Создано %d демо-столиков", len(demo))
    finally:
        db.close()

FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend"
)

if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    def _page(filename: str):
        return FileResponse(os.path.join(FRONTEND_DIR, filename))

    @app.get("/")
    def page_index():
        return _page("index.html")

    @app.get("/login.html")
    def page_login():
        return _page("login.html")

    @app.get("/register.html")
    def page_register():
        return _page("register.html")

    @app.get("/dashboard.html")
    def page_dashboard():
        return _page("dashboard.html")

    @app.get("/admin.html")
    def page_admin():
        return _page("admin.html")