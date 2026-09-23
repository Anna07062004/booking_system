from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from .logging_config import logger

_PYDANTIC_PREFIXES = (
    "Value error, ",
    "Assertion failed, ",
    "Assertion error, ",
)


def _clean_message(msg: str) -> str:

    for prefix in _PYDANTIC_PREFIXES:
        if msg.startswith(prefix):
            return msg[len(prefix):]
    return msg


def _make_json_safe(obj):

    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {k: _make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_make_json_safe(v) for v in obj]
    return str(obj)


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        logger.warning(
            "HTTP %s on %s: %s",
            exc.status_code, request.url.path, exc.detail
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        safe_errors = _make_json_safe(exc.errors())
        logger.warning("Validation error on %s: %s", request.url.path, safe_errors)

        for err in safe_errors:
            if isinstance(err, dict) and "msg" in err:
                err["msg"] = _clean_message(str(err["msg"]))

        first_msg = "Ошибка валидации данных"
        if safe_errors and isinstance(safe_errors, list):
            first = safe_errors[0]
            if isinstance(first, dict) and first.get("msg"):
                first_msg = str(first["msg"])

        return JSONResponse(
            status_code=422,
            content={
                "detail": first_msg,
                "errors": safe_errors,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled error on %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Внутренняя ошибка сервера"},
        )