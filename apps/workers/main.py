from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os

app = FastAPI(
    title="AI SEO Workers",
    description="Worker services for AI-driven SEO keyword research",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str

@app.get("/", response_model=HealthResponse)
async def root():
    return HealthResponse(
        status="ok",
        timestamp=__import__("datetime").datetime.now().isoformat(),
        version="0.1.0"
    )

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        timestamp=__import__("datetime").datetime.now().isoformat(),
        version="0.1.0"
    )

if __name__ == "__main__":
    port = int(os.getenv("WORKERS_PORT", 8001))
    host = os.getenv("WORKERS_HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
