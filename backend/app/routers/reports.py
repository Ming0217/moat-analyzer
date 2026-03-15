from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_current_user_id, require_write, require_admin
from app.services.supabase_client import get_client
from app.services.pdf_parser import parse_and_store_metrics

router = APIRouter()


class ReportNotify(BaseModel):
    """Sent by the frontend after a successful direct upload to Supabase Storage."""
    company_id: str
    report_type: str   # 'annual' | 'quarterly' | 'shareholder_letter'
    fiscal_year: int
    fiscal_quarter: Optional[int]
    storage_path: str


@router.post("/companies/{company_id}/reports", status_code=202)
async def register_report(
    company_id: str,
    payload: ReportNotify,
    user_id: str = Depends(require_write),
):
    """
    Called after the frontend uploads a PDF directly to Supabase Storage.
    Registers the report in the DB, then triggers async PDF parsing.
    """
    client = get_client()

    # Verify company belongs to user
    company = client.table("companies").select("id").eq("id", company_id).eq("user_id", user_id).single().execute()
    if not company.data:
        raise HTTPException(status_code=404, detail="Company not found")

    # Reject duplicates: same company + type + year (+ quarter for quarterly)
    dup_query = (
        client.table("reports")
        .select("id")
        .eq("company_id", company_id)
        .eq("report_type", payload.report_type)
        .eq("fiscal_year", payload.fiscal_year)
    )
    if payload.report_type == "quarterly" and payload.fiscal_quarter is not None:
        dup_query = dup_query.eq("fiscal_quarter", payload.fiscal_quarter)
    if dup_query.execute().data:
        label = f"Q{payload.fiscal_quarter} " if payload.fiscal_quarter else ""
        raise HTTPException(
            status_code=409,
            detail=f"A {payload.report_type.replace('_', ' ')} report for {label}FY{payload.fiscal_year} already exists.",
        )

    # Insert report record
    report = client.table("reports").insert({
        "user_id": user_id,
        "company_id": company_id,
        "report_type": payload.report_type,
        "fiscal_year": payload.fiscal_year,
        "fiscal_quarter": payload.fiscal_quarter,
        "storage_path": payload.storage_path,
        "parse_status": "pending",
    }).execute()

    report_id = report.data[0]["id"]

    # Trigger parsing (runs inline for now; move to background task / queue later)
    await parse_and_store_metrics(
        report_id=report_id,
        company_id=company_id,
        storage_path=payload.storage_path,
        report_type=payload.report_type,
        fiscal_year=payload.fiscal_year,
    )

    return {"report_id": report_id, "status": "processing"}


@router.get("/companies/{company_id}/reports")
async def list_reports(
    company_id: str,
    user_id: str = Depends(get_current_user_id),
):
    client = get_client()
    result = (
        client.table("reports")
        .select("*")
        .eq("company_id", company_id)
        .eq("user_id", user_id)
        .order("fiscal_year", desc=True)
        .execute()
    )
    return result.data


@router.post("/reports/{report_id}/reparse", status_code=202)
async def reparse_report(
    report_id: str,
    user_id: str = Depends(require_write),
):
    """
    Re-run parsing on an already-uploaded report.
    Useful after parser improvements (new label aliases, currency detection, etc.)
    without having to delete and re-upload the file.
    """
    client = get_client()
    report = (
        client.table("reports")
        .select("id, company_id, storage_path, report_type, fiscal_year")
        .eq("id", report_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not report.data:
        raise HTTPException(status_code=404, detail="Report not found")

    r = report.data
    await parse_and_store_metrics(
        report_id=r["id"],
        company_id=r["company_id"],
        storage_path=r["storage_path"],
        report_type=r["report_type"],
        fiscal_year=r["fiscal_year"],
    )
    return {"report_id": report_id, "status": "reparsed"}


@router.delete("/reports/{report_id}", status_code=204)
async def delete_report(
    report_id: str,
    user_id: str = Depends(require_admin),
):
    client = get_client()
    client.table("reports").delete().eq("id", report_id).eq("user_id", user_id).execute()
