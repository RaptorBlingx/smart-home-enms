from sqlalchemy.orm import Session
from sqlalchemy import text
from models.energy import EnergyConsumption, EnergyDevice, EnergyConsumptionSchema
from typing import List

class EnergyService:
    def __init__(self, db: Session):
        self.db = db

    async def record_consumption(self, consumption: EnergyConsumptionSchema):
        db_consumption = EnergyConsumption(
            device_name=consumption.device_name,
            consumption=consumption.consumption,
            timestamp=consumption.timestamp
        )
        self.db.add(db_consumption)
        self.db.commit()
        self.db.refresh(db_consumption)
        return db_consumption

    async def get_consumption(self, device_name: str):
        return self.db.query(EnergyConsumption).filter(
            EnergyConsumption.device_name == device_name
        ).first()

    async def list_consumptions(self) -> List[EnergyConsumption]:
        return self.db.query(EnergyConsumption).all()

    async def get_devices(self):
        """Get all devices from database"""
        query = text("SELECT id, name, type, status, last_updated FROM devices ORDER BY id")
        result = self.db.execute(query)
        devices = []
        for row in result:
            devices.append({
                "id": row[0],
                "name": row[1],
                "type": row[2],
                "status": row[3],
                "lastUpdated": row[4].isoformat() if row[4] else None
            })
        return devices

    def optimize_energy_usage(self):
        # Placeholder for optimization logic
        pass