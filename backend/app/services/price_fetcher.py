"""
Stock price fetcher.
Primary: Finnhub free tier (requires FINNHUB_API_KEY env var).
Fallback: yfinance (no API key, but unreliable on macOS due to LibreSSL).
"""
import time
from typing import Optional, Dict, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import yfinance as yf
from app.config import settings


# ── Simple TTL cache ─────────────────────────────────────────────────────────

_market_cache: Dict[str, Tuple[float, Dict[str, Optional[float]]]] = {}
_fx_cache: Dict[str, Tuple[float, Optional[float]]] = {}
_MARKET_TTL = 600  # 10 minutes
_FX_TTL = 3600     # 1 hour


# ── Finnhub helpers (run concurrently) ────────────────────────────────────────

def _finnhub_quote(ticker: str, api_key: str) -> Optional[float]:
    try:
        resp = requests.get(
            "https://finnhub.io/api/v1/quote",
            params={"symbol": ticker, "token": api_key},
            timeout=5,
        )
        p = resp.json().get("c")
        return float(p) if p else None
    except Exception:
        return None


def _finnhub_profile(ticker: str, api_key: str) -> Optional[float]:
    try:
        resp = requests.get(
            "https://finnhub.io/api/v1/stock/profile2",
            params={"symbol": ticker, "token": api_key},
            timeout=5,
        )
        mc = resp.json().get("marketCapitalization")
        return float(mc) * 1_000_000 if mc else None
    except Exception:
        return None


# ── Main fetch functions ──────────────────────────────────────────────────────

def fetch_market_data(ticker: str) -> Dict[str, Optional[float]]:
    """
    Returns {"price": float|None, "market_cap": float|None}.
    Results are cached for 10 minutes to reduce external API calls.
    """
    now = time.time()
    cached = _market_cache.get(ticker)
    if cached and (now - cached[0]) < _MARKET_TTL:
        return cached[1]

    result = _fetch_market_data_uncached(ticker)
    _market_cache[ticker] = (now, result)
    return result


def _fetch_market_data_uncached(ticker: str) -> Dict[str, Optional[float]]:
    """
    Fetch price and market cap from external sources.
    Finnhub quote + profile run concurrently to cut latency in half.
    Falls back to yfinance if Finnhub misses.
    """
    price: Optional[float] = None
    market_cap: Optional[float] = None

    # Primary: Finnhub — run quote and profile2 concurrently
    api_key = settings.finnhub_api_key
    if api_key:
        with ThreadPoolExecutor(max_workers=2) as pool:
            quote_future = pool.submit(_finnhub_quote, ticker, api_key)
            profile_future = pool.submit(_finnhub_profile, ticker, api_key)
            price = quote_future.result()
            market_cap = profile_future.result()

    # Fallback: yfinance (may fail on macOS due to LibreSSL)
    if price is None or market_cap is None:
        try:
            t = yf.Ticker(ticker)
            fi = t.fast_info
            if price is None:
                try:
                    p = fi.last_price
                    if p:
                        price = float(p)
                except Exception:
                    pass
            if market_cap is None:
                try:
                    mc = fi.market_cap
                    if mc:
                        market_cap = float(mc)
                except Exception:
                    pass
        except Exception:
            pass

    # Last-resort price: yfinance historical close
    if price is None:
        try:
            hist = yf.Ticker(ticker).history(period="5d")
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])
        except Exception:
            pass

    return {"price": price, "market_cap": market_cap}


def fetch_price(ticker: str) -> Optional[float]:
    """Kept for backward compatibility."""
    return fetch_market_data(ticker)["price"]


def fetch_fx_rate(currency: str) -> Optional[float]:
    """
    Return how many units of `currency` equal 1 USD.
    Results are cached for 1 hour.
    """
    if currency == "USD":
        return 1.0

    now = time.time()
    cached = _fx_cache.get(currency)
    if cached and (now - cached[0]) < _FX_TTL:
        return cached[1]

    rate = _fetch_fx_rate_uncached(currency)
    _fx_cache[currency] = (now, rate)
    return rate


def _fetch_fx_rate_uncached(currency: str) -> Optional[float]:
    """Fetch FX rate from external sources."""
    # Source 1: yfinance
    try:
        hist = yf.Ticker(f"USD{currency}=X").history(period="5d")
        if not hist.empty:
            return float(hist["Close"].iloc[-1])
    except Exception:
        pass

    # Source 2: Frankfurter (https://www.frankfurter.app) — free, no API key
    try:
        import httpx
        resp = httpx.get(
            "https://api.frankfurter.app/latest",
            params={"from": "USD", "to": currency},
            timeout=5,
        )
        if resp.status_code == 200:
            rate = resp.json().get("rates", {}).get(currency)
            if rate:
                return float(rate)
    except Exception:
        pass

    return None
