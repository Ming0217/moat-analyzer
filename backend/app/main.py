import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import companies, reports, analysis, dcf, prices, tokens, me

app = FastAPI(title="MoatAnalyzer API", version="0.1.0")

allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router, prefix="/companies", tags=["companies"])
app.include_router(reports.router, tags=["reports"])
app.include_router(analysis.router, tags=["analysis"])
app.include_router(dcf.router, tags=["dcf"])
app.include_router(prices.router, tags=["prices"])
app.include_router(tokens.router, tags=["tokens"])
app.include_router(me.router, tags=["me"])


@app.get("/health")
def health():
    return {"status": "ok"}
