from pydantic import BaseModel
from typing import Any


class MessageResponse(BaseModel):
    success: bool = True
    message: str


class PaginationMeta(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int


class PaginatedResponse(BaseModel):
    success: bool = True
    data: list[Any]
    meta: PaginationMeta


class SuccessResponse(BaseModel):
    success: bool = True
    data: Any = None
