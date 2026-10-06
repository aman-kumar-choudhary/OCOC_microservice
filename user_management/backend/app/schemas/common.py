from __future__ import annotations

from typing import Any, Dict, Generic, Optional, TypeVar
from pydantic import BaseModel
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
T = TypeVar("T")

class ErrorDetail(BaseModel):
    code: str
    message: str


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    error: Optional[ErrorDetail] = None


def success_response(data: Any = None, message: Optional[str] = None, status_code: int = 200) -> JSONResponse:
    content: Dict[str, Any] = {"success": True}
    if data is not None:
        content["data"] = data
    if message is not None:
        content["message"] = message
    return JSONResponse(status_code=status_code, content=jsonable_encoder(content))


def error_response(code: str, message: str, status_code: int = 400, details: Optional[Any] = None) -> JSONResponse:
    content: Dict[str, Any] = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
        },
    }
    if details is not None:
        content["error"]["details"] = details
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(content),
    )
