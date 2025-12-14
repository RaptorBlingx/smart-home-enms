from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://user:password@postgres:5432/smart_home"
    SECRET_KEY: str = "your_secret_key_change_this_in_production"
    API_PREFIX: str = "/api"
    DEBUG: bool = False
    ALLOW_ORIGINS: str = "http://localhost:3002,http://localhost:3000,http://frontend:3000"
    MQTT_BROKER_URL: str = "mqtt://mosquitto:1883"
    MQTT_TOPIC: str = "smart_home/energy"
    ELECTRICITY_RATE: float = 0.12  # USD per kWh

    @property
    def origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOW_ORIGINS.split(',')]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()