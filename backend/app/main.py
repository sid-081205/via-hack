from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.config import settings
from app.routers import trips, messages, todos, agents, travel_plan

app = FastAPI(title="Via Travel Agent API", version="1.0.0")

# CORS
origins = [o.strip() for o in settings.CORS_ALLOW_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(trips.router)
app.include_router(messages.router)
app.include_router(todos.router)
app.include_router(agents.router)
app.include_router(travel_plan.router)

# Static files (index.html)
_static_dir = Path(__file__).parent.parent / "static"
if _static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/")
async def root():
    index_path = _static_dir / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "Via Travel Agent API", "docs": "/docs"}
