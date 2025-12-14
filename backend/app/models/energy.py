from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean
from database.connection import Base
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class EnergyConsumption(Base):
    __tablename__ = 'energy_consumption'

    id = Column(Integer, primary_key=True, index=True)
    device_name = Column(String, index=True)
    consumption = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

class EnergyDevice(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    type = Column(String, nullable=False)
    status = Column(String, default="on", nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow)

# Pydantic schemas
class EnergyConsumptionSchema(BaseModel):
    device_name: str
    consumption: float
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True

class EnergyDeviceSchema(BaseModel):
    name: str
    type: str
    status: str

    class Config:
        from_attributes = True