"""
Stock price fetcher.
Primary: Finnhub free tier (requires FINNHUB_API_KEY env var).
Fallback: yfinance (no API key, but unreliable on macOS due to LibreSSL).
"""
from typing import Optional, Dict
import requests
import yfinance as yf
from app.config import settings


def fetch_market_data(ticker: str) -> Dict[str, Optional[float]]:
    """
    Returns {"price": float|None, "market_cap": float|None}.
    Market cap is fetched directly from yfinance to avoid relying on
    PDF-parsed shares_outstanding (which can be wrong due to scale issues).
    """
    price: Optional[float] = None
    market_cap: Optional[float] = None

    # Primary: Finnhub — price from /quote, market cap from /stock/profile2
    api_key = settings.finnhub_api_key
    if api_key:
        try:
            resp = requests.get(
                "https://finnhub.io/api/v1/quote",
                params={"symbol": ticker, "token": api_key},
                timeout=5,
            )
            p = resp.json().get("c")
            if p:
                price = float(p)
        except Exception:
            pass
        try:
            resp = requests.get(
                "https://finnhub.io/api/v1/stock/profile2",
                params={"symbol": ticker, "token": api_key},
                timeout=5,
            )
            # marketCapitalization is in millions USD
            mc = resp.json().get("marketCapitalization")
            if mc:
                market_cap = float(mc) * 1_000_000
        except Exception:
            pass

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
    e.g. for CNY returns ~7.2 (meaning 7.2 RMB per USD).
    Returns 1.0 for USD.

    Tries two sources:
    1. yfinance (fast but fails on macOS with LibreSSL)
    2. Frankfurter open API (no key required, always available)
    """
    if currency == "USD":
        return 1.0

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
