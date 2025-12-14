import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as api_router
from config import settings
from database.connection import engine, Base

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Home Energy Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=False if '*' in settings.origins_list else True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Smart Home Energy Management System API"}