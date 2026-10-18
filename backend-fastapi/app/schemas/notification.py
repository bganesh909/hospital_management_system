from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    message: str
    type: str
    reference_type: str | None
    reference_id: UUID | None
    is_read: bool
    sent_via: str
    email_sent: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    unread_count: int


class NotificationPreferenceResponse(BaseModel):
    id: UUID
    user_id: UUID
    appointment_email: bool
    lab_result_email: bool
    billing_email: bool
    system_email: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotificationPreferenceUpdate(BaseModel):
    appointment_email: bool | None = None
    lab_result_email: bool | None = None
    billing_email: bool | None = None
    system_email: bool | None = None
