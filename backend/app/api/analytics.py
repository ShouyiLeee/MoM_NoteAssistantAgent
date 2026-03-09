"""
Analytics API — aggregated interview performance data for the dashboard.
"""

from fastapi import APIRouter
from sqlalchemy import func, select

from app.db.postgres import AsyncSessionLocal
from app.models.interview import Interview
from app.schemas.interview import AnalyticsResponse

router = APIRouter()


@router.get("/{user_id}", response_model=AnalyticsResponse)
async def get_analytics(user_id: str):
    """
    Return aggregated interview performance stats for the dashboard.
    Includes: total count, pass rate, breakdown by result/stage/company, monthly timeline.
    """
    async with AsyncSessionLocal() as session:

        # ── By result ─────────────────────────────────────────────────────────
        result_rows = await session.execute(
            select(Interview.result, func.count(Interview.id))
            .where(Interview.user_id == user_id)
            .group_by(Interview.result)
        )
        by_result: dict[str, int] = {}
        for result_val, count in result_rows:
            by_result[result_val or "Unknown"] = count

        total = sum(by_result.values())
        pass_count = by_result.get("Pass", 0)
        pass_rate = round(pass_count / total * 100, 1) if total > 0 else 0.0

        # ── By stage ──────────────────────────────────────────────────────────
        stage_rows = await session.execute(
            select(Interview.stage, Interview.result, func.count(Interview.id))
            .where(Interview.user_id == user_id)
            .group_by(Interview.stage, Interview.result)
        )
        by_stage: dict[str, dict] = {}
        for stage, result_val, count in stage_rows:
            key = stage or "Unknown"
            if key not in by_stage:
                by_stage[key] = {"total": 0, "pass": 0, "fail": 0, "pending": 0}
            by_stage[key]["total"] += count
            bucket = (result_val or "").lower()
            if bucket in ("pass", "fail", "pending"):
                by_stage[key][bucket] += count

        # ── By company (top 10) ───────────────────────────────────────────────
        company_rows = await session.execute(
            select(Interview.company, Interview.result, func.count(Interview.id))
            .where(Interview.user_id == user_id)
            .group_by(Interview.company, Interview.result)
        )
        by_company_raw: dict[str, dict] = {}
        for company, result_val, count in company_rows:
            key = company or "Unknown"
            if key not in by_company_raw:
                by_company_raw[key] = {"total": 0, "pass": 0, "fail": 0, "pending": 0}
            by_company_raw[key]["total"] += count
            bucket = (result_val or "").lower()
            if bucket in ("pass", "fail", "pending"):
                by_company_raw[key][bucket] += count

        by_company = dict(
            sorted(by_company_raw.items(), key=lambda x: x[1]["total"], reverse=True)[:10]
        )

        # ── Monthly timeline ──────────────────────────────────────────────────
        timeline_rows = await session.execute(
            select(
                func.date_trunc("month", Interview.date).label("month"),
                func.count(Interview.id).label("count"),
            )
            .where(Interview.user_id == user_id)
            .where(Interview.date.isnot(None))
            .group_by("month")
            .order_by("month")
        )
        timeline = [
            {"month": str(row[0])[:7], "count": row[1]}
            for row in timeline_rows
            if row[0]
        ]

        # ── Most common failure stage ─────────────────────────────────────────
        fail_stage = None
        if by_stage:
            fail_stage = max(by_stage.items(), key=lambda x: x[1].get("fail", 0))[0]

        return AnalyticsResponse(
            total=total,
            pass_rate=pass_rate,
            by_result=by_result,
            by_stage=by_stage,
            by_company=by_company,
            timeline=timeline,
            weakest_stage=fail_stage,
        )
