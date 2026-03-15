# MoatAnalyzer

Analyze company economic moats using Pat Dorsey's framework from *The Little Book That Builds Wealth*.

Upload SEC filings (10-K, 10-Q, 20-F) and shareholder letters — AI identifies moat sources, assesses valuation quality, computes financial ratios, and builds an interactive DCF model.

## Features

- **Moat identification** — AI classifies intangible assets, switching costs, network effects, and cost advantages
- **Valuation quality** — rates growth, risk, return on capital, and moat duration
- **Interactive DCF** — adjust growth rates, discount rates, and projection years with live sliders
- **Filing analysis** — extracts financial metrics from PDF and HTML filings automatically
- **Multi-user** — private portfolios with Row Level Security on Supabase
- **API access** — Personal Access Tokens with scoped permissions (read/write/admin)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Python, FastAPI, Pydantic |
| Auth & DB | Supabase (PostgreSQL, Auth, Storage) |
| LLM | Claude API (Anthropic) |
| Filing parsing | pdfplumber, BeautifulSoup |
| Market data | Finnhub, yfinance |

## Architecture

```
frontend/          → React app (Vercel)
backend/           → FastAPI app (Render)
Supabase           → PostgreSQL + Auth + File Storage
```

The frontend uploads PDFs directly to Supabase Storage, then notifies the backend to parse them. LLM analysis runs server-side via Claude. The DCF calculator is pure math with no LLM dependency.

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Supabase project (free tier works)
- Anthropic API key
- Finnhub API key (free at finnhub.io)

### Frontend

```bash
cd frontend
cp .env.example .env    # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
npm install
npm run dev             # http://localhost:5173
```

### Backend

```bash
cd backend
cp .env.example .env    # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, FINNHUB_API_KEY
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000
```

### Environment Variables

**Frontend** (`frontend/.env`):
| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_API_URL` | Backend URL (`http://localhost:8000` for local dev) |

**Backend** (`backend/.env`):
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `ANTHROPIC_API_KEY` | Claude API key |
| `FINNHUB_API_KEY` | Finnhub API key for live stock prices |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (e.g. `https://your-app.vercel.app,http://localhost:5173`) |

## Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | Vercel | Auto-deploys from `main` branch |
| Backend | Render | Set root directory to `backend`, start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Database | Supabase | Free tier: 500MB DB, 1GB storage |

## API

The backend exposes a REST API with OpenAPI docs at `/docs`. External access is available via Personal Access Tokens — see the in-app API Reference at `/api-docs`.

Key endpoints:
- `GET /companies` — list portfolio
- `POST /companies/{id}/analyze` — trigger LLM analysis
- `POST /analyses/{id}/dcf` — recalculate DCF with custom assumptions
- `GET /companies/{id}/price` — fetch live stock price

## Methodology

Based on Pat Dorsey's economic moat framework (Chapters 11–13):

1. **Moat check** — examine historical ROE, ROIC, FCF margins for signs of durable advantage
2. **Moat identification** — classify into four moat types
3. **Valuation quality** — assess the four value drivers (growth, risk, ROC, duration)
4. **Valuation tools** — P/S, P/B, P/E, P/FCF, earnings yield, cash return, and two-stage DCF

## License

This project is for personal/educational use.
