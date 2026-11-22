"""Pydantic v2 request and response models."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

DonorType = Literal["restaurant", "caterer", "hotel", "event_organiser", "wedding_host"]


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=200)
    phone: Optional[str] = None
    # Admin accounts cannot be self-registered.
    role: Literal["donor", "ngo", "volunteer", "sponsor"]
    donor_type: Optional[DonorType] = None
    business_name: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    beneficiary_capacity: Optional[int] = Field(default=None, ge=0)
    service_lat: Optional[float] = None
    service_lng: Optional[float] = None
    service_radius_km: Optional[float] = Field(default=None, gt=0)


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    role: str
    name: str
    email: str
    verification_status: str
    anonymous_public: bool
    donor_type: Optional[str] = None


class TokenOut(BaseModel):
    token: str
    expires_at: str
    user: UserOut
