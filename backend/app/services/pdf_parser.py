"""
Filing parser service.

Downloads a PDF or HTM/HTML file from Supabase Storage, extracts financial
tables and text, and stores structured metrics in the financial_metrics table.

Supports:
  - PDF  (via pdfplumber) — printed 10-K/10-Q/20-F
  - HTM/HTML (via BeautifulSoup) — SEC EDGAR inline iXBRL filings

Heuristics target standard SEC 10-K / 10-Q / 20-F formatting. Partial
extractions are still stored so the LLM analysis step can fill gaps from
the raw text.
"""
import io
import re
from typing import Optional, Tuple, List, Dict

import pdfplumber
from bs4 import BeautifulSoup
from app.services.supabase_client import get_client


async def parse_and_store_metrics(
    report_id: str,
    company_id: str,
    storage_path: str,
    report_type: str,
    fiscal_year: int,
) -> None:
    client = get_client()

    # Mark as processing
    client.table("reports").update({"parse_status": "processing"}).eq("id", report_id).execute()

    try:
        # Download file bytes from Supabase Storage
        response = client.storage.from_("reports").download(storage_path)
        file_bytes = io.BytesIO(response)

        is_html = storage_path.lower().endswith((".htm", ".html"))
        if is_html:
            text, tables = _extract_html(file_bytes)
        else:
            text, tables = _extract_pdf(file_bytes)

        # Auto-detect fiscal year from document content; fall back to user-supplied value.
        # Only overwrite reports.fiscal_year when detection succeeds — don't clobber a
        # previously-correct value with a wrong fallback when re-parsing a report whose
        # stored fiscal_year has already been manually corrected.
        detected_year = _detect_fiscal_year(text, storage_path, is_html=is_html)
        actual_year = detected_year if detected_year else fiscal_year

        report_update: dict = {"extracted_text": text[:50_000]}
        if detected_year:
            report_update["fiscal_year"] = detected_year
        client.table("reports").update(report_update).eq("id", report_id).execute()

        if report_type == "shareholder_letter":
            client.table("reports").update({"parse_status": "done"}).eq("id", report_id).execute()
            return

        # If the detected year differs from the previously-stored fiscal_year, delete
        # the stale financial_metrics row so it doesn't persist alongside the correct one.
        if detected_year and detected_year != fiscal_year:
            client.table("financial_metrics").delete().eq(
                "company_id", company_id
            ).eq("fiscal_year", fiscal_year).execute()

        # For annual/quarterly reports, extract structured financial metrics
        metrics = _parse_financials(text, tables, html_mode=is_html)
        if metrics:
            reporting_currency = _detect_currency(text)
            client.table("financial_metrics").upsert({
                "company_id": company_id,
                "fiscal_year": actual_year,
                "reporting_currency": reporting_currency,
                **metrics,
            }, on_conflict="company_id,fiscal_year").execute()

        client.table("reports").update({"parse_status": "done"}).eq("id", report_id).execute()

    except Exception as e:
        client.table("reports").update({
            "parse_status": "failed",
            "parse_error": str(e),
        }).eq("id", report_id).execute()
        raise


# ── Fiscal year detection ────────────────────────────────────────────────────────

def _detect_fiscal_year(text: str, storage_path: str, is_html: bool = False) -> Optional[int]:
    """
    Detect the fiscal year end from the document itself, ignoring the user-supplied
    value (which may reflect the filing date rather than the fiscal year end).

    Strategy 1 — SEC EDGAR YYYYMMDD embedded in the original filename:
      Files are named like  pdd-20241231x20f.htm  → fiscal period end 2024-12-31.
      We look specifically for 8-digit sequences that look like a calendar date
      (year 2000-2100, month 01-12, day 01-31) to avoid false hits from numeric
      upload timestamps (e.g. "1741958400000_" in the storage path prefix).

    Strategy 2 — Standalone 4-digit year in the filename:
      Fallback if the filename does not follow the full YYYYMMDD convention
      but still has a plain year like "2024" in the name.

    Strategy 3 — Document text:
      Look for "for the fiscal year ended ... 2024" or
      "year ended december 31, 2024" in the extracted text.
      iXBRL HTML filings have a large XBRL header section at the top that can
      push the cover-page text well past 20 KB, so we scan up to 500 KB for
      HTML files and 30 KB for PDFs.
      We do NOT use a loose "annual report ... YYYY" pattern because XBRL header
      sections in iXBRL filings contain IFRS/US-GAAP taxonomy version dates
      (e.g. 2014, 2015, 2016) that would be mistaken for the fiscal year.
    """
    # Strategy 1: SEC EDGAR YYYYMMDD in the filename
    # Split on the last "/" to get the actual filename (the storage path includes
    # a {user_id}/{company_id}/{timestamp}_{original_name} prefix).
    filename = storage_path.split("/")[-1]
    for m in re.finditer(r'(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:x|\.htm|\.pdf|_)', filename):
        year = int(m.group(1))
        if 2000 <= year <= 2100:
            return year

    # Strategy 2: plain 4-digit year anywhere in the filename (e.g. "AAPL-2024-10K.pdf")
    for m in re.finditer(r'(?<!\d)(20\d{2})(?!\d)', filename):
        year = int(m.group(1))
        if 2000 <= year <= 2100:
            return year

    # Strategy 3: "fiscal year ended [Month Day,] YYYY" in document text.
    # Use a larger scan window for HTML (iXBRL headers can be hundreds of KB).
    # Collect ALL matches and return the MAXIMUM year found — annual reports
    # reference multiple prior years in comparative tables, and the current
    # fiscal year is always the most recent one.
    # iXBRL <ix:header> is stripped in _extract_html, so 30K is sufficient for both.
    scan_limit = 30_000
    lower = text[:scan_limit].lower()
    patterns = [
        r"for\s+the\s+fiscal\s+year\s+ended\s+\w+\s+\d+,?\s+(\d{4})",
        r"fiscal\s+year\s+ended\s+\w+\s+\d+,?\s+(\d{4})",
        r"year\s+ended\s+(?:december|january|february|march|april|may|june|july|august|september|october|november)\s+\d+,?\s+(\d{4})",
    ]
    candidate_years: List[int] = []
    for pattern in patterns:
        for m in re.finditer(pattern, lower):
            year = int(m.group(1))
            if 2000 <= year <= 2100:
                candidate_years.append(year)
    if candidate_years:
        return max(candidate_years)

    return None


# ── File extraction ─────────────────────────────────────────────────────────────

def _extract_pdf(pdf_bytes: io.BytesIO) -> Tuple[str, List]:
    """Extract full text and all tables from a PDF using pdfplumber."""
    full_text = []
    all_tables = []
    with pdfplumber.open(pdf_bytes) as pdf:
        for page in pdf.pages:
            full_text.append(page.extract_text() or "")
            tables = page.extract_tables()
            if tables:
                all_tables.extend(tables)
    return "\n".join(full_text), all_tables


def _extract_html(html_bytes: io.BytesIO) -> Tuple[str, List]:
    """
    Extract full text and tables from an HTM/HTML file.

    Designed for SEC EDGAR inline iXBRL filings (10-K, 10-Q, 20-F).
    BeautifulSoup strips all markup so the same table-label and text-regex
    heuristics used for PDFs work without modification.
    """
    content = html_bytes.read().decode("utf-8", errors="replace")
    soup = BeautifulSoup(content, "html.parser")

    # Remove script/style content so it doesn't pollute extracted text.
    # Also remove the iXBRL XBRL header section (<ix:header>) which can be
    # 1-3 MB of XBRL context/unit definitions in SEC EDGAR inline XBRL filings.
    # That metadata precedes the actual document body and would otherwise push
    # the cover-page text ("For the fiscal year ended December 31, 2020") far
    # beyond any reasonable scan limit.
    for tag in soup(["script", "style", "ix:header"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    all_tables = []
    for table in soup.find_all("table"):
        rows = []
        for tr in table.find_all("tr"):
            cells = [
                td.get_text(separator=" ", strip=True)
                for td in tr.find_all(["td", "th"])
            ]
            if cells:
                rows.append(cells)
        if rows:
            all_tables.append(rows)

    return text, all_tables


# ── Currency detection ──────────────────────────────────────────────────────────

def _detect_currency(text: str) -> str:
    """
    Detect the reporting currency from the document text.
    Returns an ISO 4217 currency code ('USD', 'CNY', 'EUR', etc.).
    Defaults to 'USD' when no foreign-currency marker is found.
    """
    lower = text[:60_000].lower()
    # Ordered most-specific first so we don't misclassify
    _CURRENCY_PATTERNS = [
        # RMB / CNY  (Chinese filings: 10-F, 20-F)
        (r'\bin\s+thousands?\s+of\s+rmb\b',           'CNY'),
        (r'\bin\s+millions?\s+of\s+rmb\b',            'CNY'),
        (r'\bin\s+billions?\s+of\s+rmb\b',            'CNY'),
        (r'\brmb\s+in\s+thousands\b',                 'CNY'),
        (r'\brmb\s+in\s+millions\b',                  'CNY'),
        (r'\bin\s+thousands?\s+of\s+cny\b',           'CNY'),
        (r'\brenminbi\b',                              'CNY'),
        # Japanese Yen
        (r'\bin\s+millions?\s+of\s+(?:japanese\s+)?yen\b', 'JPY'),
        (r'\bin\s+thousands?\s+of\s+(?:japanese\s+)?yen\b', 'JPY'),
        # Korean Won
        (r'\bin\s+(?:millions?|thousands?)\s+of\s+korean\s+won\b', 'KRW'),
        (r'\bin\s+(?:millions?|thousands?)\s+of\s+won\b', 'KRW'),
        # Euro
        (r'\bin\s+(?:millions?|thousands?)\s+of\s+euros?\b', 'EUR'),
        # British Pound
        (r'\bin\s+(?:millions?|thousands?)\s+of\s+(?:british\s+)?pounds?\b', 'GBP'),
        (r'\bin\s+(?:millions?|thousands?)\s+sterling\b', 'GBP'),
        # Indian Rupee
        (r'\bin\s+(?:millions?|thousands?|crores?)\s+of\s+(?:indian\s+)?rupees?\b', 'INR'),
    ]
    for pattern, currency in _CURRENCY_PATTERNS:
        if re.search(pattern, lower):
            return currency
    return 'USD'


# ── Scale detection ─────────────────────────────────────────────────────────────

def _detect_scale(text: str) -> float:
    """
    Return the unit multiplier implied by the financial table header.
    Searches the full document since scale hints in 10-Ks often appear
    near the financial statements (which may be in the second half).
    Counts occurrences and picks the most common hint.
    """
    lower = text.lower()
    billions  = len(re.findall(r'\bin\s+billions\b', lower))
    millions  = len(re.findall(r'\bin\s+millions\b', lower))
    thousands = len(re.findall(r'\bin\s+thousands\b', lower))

    if billions > millions and billions > thousands:
        return 1_000_000_000.0
    if millions > thousands:
        return 1_000_000.0
    if thousands > 0:
        return 1_000.0
    return 1.0


# ── Number parsing ──────────────────────────────────────────────────────────────

def _parse_num(s: Optional[str]) -> Optional[float]:
    """
    Parse a table cell value into a float.
    Handles: '1,234.5'  '(1,234)'  '$ 99,803'  '—'  ''
    """
    if not s:
        return None
    s = str(s).strip()
    # Treat dashes and blanks as missing
    if s in ('—', '–', '-', 'N/A', 'n/a', ''):
        return None
    negative = s.startswith('(') and s.endswith(')')
    s = s.strip('()').replace(',', '').replace('$', '').replace('\xa0', '').strip()
    try:
        val = float(s)
        return -val if negative else val
    except ValueError:
        return None


# ── Table-based extraction ──────────────────────────────────────────────────────

# Map DB column → ordered list of lowercase substrings to match against row labels.
# Listed most-specific first so we match the best alias before the generic one.
_TABLE_LABELS: Dict[str, List[str]] = {
    "revenue": [
        "total net revenues", "net revenues", "total revenues",
        "revenues", "net sales", "total net sales", "total revenue",
        "net revenue",
    ],
    "net_income": [
        "net income attributable to",
        "net income",
        "net earnings attributable to",
        "net earnings",
        "profit for the year",                           # IFRS / 20-F
        "profit for the period",                         # IFRS / 20-F
        "net profit",
    ],
    "operating_income": [
        "income from operations",
        "operating income",
        "operating profit",
    ],
    "eps": [
        "diluted earnings per share",
        "basic earnings per share",
        "earnings per diluted share",
        "earnings per share",
        "net income per diluted share",
        "net income per share",
    ],
    "interest_expense": [
        "interest expense",
    ],
    "total_equity": [
        "total shareholders' equity",
        "total stockholders' equity",
        "total shareholders equity",
        "total stockholders equity",
        "total equity",
        # Catch "Total [Company Name] stockholders' equity" variations
        "stockholders' equity",
        "stockholders equity",
        "shareholders' equity",
        "shareholders equity",
    ],
    "total_debt": [
        "total debt",
        "long-term debt, net of discount",
        "long-term debt, net",
        "long-term debt",
        "total long-term debt",
        "notes payable",
        "total borrowings",
        "total financial debt",
    ],
    "cash": [
        "cash, cash equivalents, and short-term investments",
        "cash, cash equivalents and short-term investments",
        "cash and cash equivalents and short-term investments",
        "cash and cash equivalents",
        "cash and short-term investments",
    ],
    "book_value_per_share": [
        "book value per share",
        "tangible book value per share",
    ],
    "shares_outstanding": [
        "shares used in computing diluted",
        "diluted weighted-average shares",
        "weighted-average diluted shares",
        "weighted-average shares outstanding, diluted",
        "weighted-average common shares outstanding",
        "common shares outstanding",
        "shares outstanding",
    ],
    "operating_cash_flow": [
        "net cash generated from operating activities",   # IFRS / 20-F
        "net cash generated by operating activities",
        "net cash provided by operating activities",
        "cash provided by operating activities",
        "net cash from operating activities",
        "net cash flows from operating activities",       # IFRS variant
    ],
    "capex": [
        "purchases of property, plant and equipment",
        "purchase of property, plant and equipment",
        "purchases of property and equipment",
        "purchase of property and equipment",
        "capital expenditures",
        "capital expenditure",                            # IFRS singular
        "additions to property, plant and equipment",
        "acquisition of property, plant and equipment",  # 20-F variant
        # PDD / Chinese 20-F variant (includes software & intangible assets)
        "purchase of property, equipment and software and intangible assets",
        "purchase of property, equipment and software",
        "purchases of property, equipment and software",
    ],
    "free_cash_flow": [
        "free cash flow",
    ],
}

# These metrics are in actual units (not scaled by "in thousands/millions").
# Per-share values are stated in dollars; share counts are stated as whole numbers.
_UNSCALED_METRICS = {"eps", "book_value_per_share", "shares_outstanding"}


def _parse_embedded_value(cell: str) -> Optional[float]:
    """
    Extract the first dollar amount or number from a dot-leader cell.
    Handles: "Revenue........ $ 1,300,205 $ 804"  →  1300205
             "Net income...... $ (484,276)"        →  -484276
             "Shares........   145,472,389"         →  145472389
    """
    # Split on dot leaders to isolate the values portion
    parts = re.split(r'\.{3,}', cell, maxsplit=1)
    search_str = parts[1] if len(parts) == 2 else cell

    # Match first value: optional $, then optional negative parens or plain number
    m = re.search(r'\$?\s*(\([\d,]+(?:\.\d+)?\)|[\d,]+(?:\.\d+)?)', search_str)
    if m:
        return _parse_num(m.group(1))
    return None


def _normalize_label(cell: str) -> str:
    label = re.sub(r'\s+', ' ', str(cell)).lower().strip()
    label = label.replace('\u2019', "'").replace('\u2018', "'")
    label = label.replace('\u201c', '"').replace('\u201d', '"')
    label = label.replace('\u200b', '')  # remove zero-width spaces
    return label


def _extract_from_tables(tables: List, scale: float, html_mode: bool = False) -> Dict[str, float]:
    """
    Scan tables for known financial line items.

    pdf_mode (html_mode=False):
      First matching row wins; first non-null cell = most recent year (US 10-K column order).

    html_mode=True (iXBRL SEC filings):
      Collects ALL rows matching each metric, then picks the candidate with the
      largest absolute value.  This handles two iXBRL quirks:
        1. Multiple table sections (consolidated > VIE > parent-only) — consolidated
           values are always the largest, so max-abs naturally selects them.
        2. Column order is oldest-first in 20-F (2022 | 2023 | 2024 | 2024-USD);
           the most recent RMB year is also the largest for growing companies, and
           always larger than the USD equivalent (~7× smaller).
    """
    if html_mode:
        return _extract_from_tables_html(tables, scale)

    metrics: Dict[str, float] = {}
    for table in tables:
        for row in table:
            if not row or not row[0]:
                continue
            label = _normalize_label(row[0])
            for metric, aliases in _TABLE_LABELS.items():
                if metric in metrics:
                    continue
                if not any(alias in label for alias in aliases):
                    continue
                # Strategy 1: multi-column table
                val = None
                for cell in row[1:]:
                    val = _parse_num(cell)
                    if val is not None:
                        break
                # Strategy 2: dot-leader single cell
                if val is None:
                    val = _parse_embedded_value(str(row[0]))
                if val is not None:
                    metrics[metric] = val * (1.0 if metric in _UNSCALED_METRICS else scale)
                    break
    return metrics


def _extract_from_tables_html(tables: List, scale: float) -> Dict[str, float]:
    """
    HTML-specific extraction for iXBRL SEC filings.

    Collects ALL numeric candidates for each metric across every matching table row,
    then picks the best value using two heuristics:

    1. Majority-sign: iXBRL documents contain the same figure in many contexts
       (income statement, equity rollforward, cash flow reconciliation, parent-only
       statements, VIE statements, …).  Some contexts show a number in parentheses
       even though the underlying value is positive (e.g. net income appears as a
       credit deduction in an equity table as "(112,434,512)").  Counting all
       occurrences and taking the sign held by the majority avoids being misled by a
       single parenthetical appearance.

    2. Max-abs within the majority-sign group: the consolidated statements always
       contain the largest figures, and the most-recent year column is the largest
       for a growing company, so the highest-magnitude value is both the right entity
       and the right year.
    """
    from collections import defaultdict
    candidates: Dict[str, List[float]] = defaultdict(list)

    for table in tables:
        for row in table:
            if not row or not row[0]:
                continue
            label = _normalize_label(row[0])
            for metric, aliases in _TABLE_LABELS.items():
                if not any(alias in label for alias in aliases):
                    continue
                row_vals = [v for cell in row[1:] if (v := _parse_num(cell)) is not None]
                if not row_vals:
                    embedded = _parse_embedded_value(str(row[0]))
                    if embedded is not None:
                        row_vals = [embedded]
                candidates[metric].extend(row_vals)

    metrics: Dict[str, float] = {}
    for metric, values in candidates.items():
        pos = [v for v in values if v >= 0]
        neg = [v for v in values if v < 0]
        # Choose the majority-sign group; ties go to positive
        group = pos if len(pos) >= len(neg) else neg
        best = max(group, key=abs)
        metrics[metric] = best * (1.0 if metric in _UNSCALED_METRICS else scale)
    return metrics


# ── Text-based fallback ─────────────────────────────────────────────────────────

# Used only for metrics not found in tables. Each pattern has one capture group
# for the raw number string (without scale applied).
_TEXT_PATTERNS: Dict[str, List[str]] = {
    "revenue": [
        r"total\s+net\s+revenues?\s+[\$\s]*([\d,]+(?:\.\d+)?)",
        r"net\s+revenues?\s+[\$\s]*([\d,]+(?:\.\d+)?)",
        r"total\s+revenues?\s+[\$\s]*([\d,]+(?:\.\d+)?)",
        r"net\s+sales\s+[\$\s]*([\d,]+(?:\.\d+)?)",
    ],
    "net_income": [
        r"net\s+income\s+[\$\s]*\(?([\d,]+(?:\.\d+)?)\)?(?:\s|$)",
        r"net\s+earnings\s+[\$\s]*\(?([\d,]+(?:\.\d+)?)\)?(?:\s|$)",
    ],
    "operating_income": [
        r"income\s+from\s+operations\s+[\$\s]*([\d,]+(?:\.\d+)?)",
        r"operating\s+income\s+[\$\s]*([\d,]+(?:\.\d+)?)",
    ],
    "interest_expense": [
        r"interest\s+expense\s+[\$\s]*\(?([\d,]+(?:\.\d+)?)\)?",
    ],
    "operating_cash_flow": [
        r"net\s+cash\s+(?:provided|generated)\s+by\s+operating\s+activities[^\d\(]+([\d,]+(?:\.\d+)?)",
        r"net\s+cash\s+(?:provided|generated)\s+by\s+operating\s+activities\s+[\$\s]*([\d,]+(?:\.\d+)?)",
        r"cash\s+(?:provided|generated)\s+by\s+operating\s+activities[^\d\(]+([\d,]+(?:\.\d+)?)",
    ],
    "capex": [
        r"capital\s+expenditures?\s+[\$\s]*\(?([\d,]+(?:\.\d+)?)\)?",
        r"purchases?\s+of\s+property,?\s+plant\s+and\s+equipment\s+[\$\s]*\(?([\d,]+(?:\.\d+)?)\)?",
    ],
    "total_equity": [
        r"total\s+stockholders['']?\s+equity\s+[\$\s]*([\d,]+(?:\.\d+)?)",
        r"total\s+shareholders['']?\s+equity\s+[\$\s]*([\d,]+(?:\.\d+)?)",
        r"total\s+equity\s+[\$\s]*([\d,]+(?:\.\d+)?)",
    ],
    "total_debt": [
        r"total\s+(?:long[- ]term\s+)?debt\s+[\$\s]*([\d,]+(?:\.\d+)?)",
        r"long[- ]term\s+debt(?:,\s*net)?\s+[\$\s]*([\d,]+(?:\.\d+)?)",
    ],
}


def _fill_from_text(metrics: Dict[str, float], text: str, scale: float) -> None:
    """Fill any metrics missing after table extraction using regex on raw text."""
    # Normalize curly quotes so patterns with straight apostrophes match PDF text
    text = text.replace('\u2019', "'").replace('\u2018', "'")
    for metric, patterns in _TEXT_PATTERNS.items():
        if metric in metrics:
            continue
        for pattern in patterns:
            m = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if m:
                val = _parse_num(m.group(1))
                if val is not None:
                    mult = 1.0 if metric in _UNSCALED_METRICS else scale
                    metrics[metric] = val * mult
                    break


# ── Main entry point ────────────────────────────────────────────────────────────

def _parse_financials(text: str, tables: List, html_mode: bool = False) -> Optional[Dict]:
    """
    Heuristic extraction of key financial line items.

    Strategy:
      1. Detect the scale (millions / thousands / billions) from table headers.
      2. Scan pdfplumber tables for labelled rows matching known line items.
      3. Fall back to regex on raw text for anything not found in tables.
      4. Derive FCF = OCF − |capex| if not found directly.

    Returns a dict ready to upsert into financial_metrics, or None if nothing
    could be extracted.
    """
    scale = _detect_scale(text)
    metrics = _extract_from_tables(tables, scale, html_mode=html_mode)
    _fill_from_text(metrics, text, scale)

    # Derive FCF from OCF − |capex| whenever both are available.
    # This takes precedence over any "free cash flow" label found in tables/text,
    # because non-GAAP "Free Cash Flow" labels vary by company and can be misread.
    # OCF and capex come from standard GAAP cash flow statement lines, which are
    # consistently labeled and reliably parsed.
    ocf = metrics.get("operating_cash_flow")
    capex = metrics.get("capex")
    if ocf is not None and capex is not None:
        # capex may be stored as negative (cash outflow) or positive — normalise
        metrics["free_cash_flow"] = ocf - abs(capex)

    return metrics if metrics else None
