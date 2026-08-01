"""Job Discovery API routes.

Provides endpoints for ad-hoc job searches, saved searches,
discovered job management, and provider rate-limit status.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from services.auth_service import get_current_user_id

router = APIRouter(prefix="/api/job-discovery", tags=["job-discovery"])


def _db():
    from main import database_service  # local import avoids circular load
    return database_service


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class SavedSearchCreate(BaseModel):
    name: str
    keywords: str
    location: str = ""
    remote_filter: str = "any"   # "any"|"remote"|"local"|"hybrid"
    providers: list = ["adzuna", "jsearch", "themuse", "remoteok"]
    ai_scoring: bool = True


class SavedSearchUpdate(BaseModel):
    name: Optional[str] = None
    keywords: Optional[str] = None
    location: Optional[str] = None
    remote_filter: Optional[str] = None
    providers: Optional[list] = None
    ai_scoring: Optional[bool] = None
    is_active: Optional[bool] = None


class AdHocSearchRequest(BaseModel):
    keywords: str
    location: str = ""
    remote_filter: str = "any"
    providers: list = ["adzuna", "jsearch", "themuse", "remoteok"]
    max_results: int = 25


class DiscoveredJobUpdate(BaseModel):
    is_dismissed: Optional[bool] = None
    is_saved: Optional[bool] = None
    is_imported: Optional[bool] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_search_params(
    keywords: str,
    location: str,
    remote_filter: str,
    max_results: int = 25,
):
    """Build a SearchParams object from raw fields."""
    from services.job_search_service import SearchParams
    return SearchParams(
        keywords=keywords,
        location=location,
        remote_filter=remote_filter,
        max_results=max_results,
    )


def _run_search_and_upsert(
    keywords: str,
    location: str,
    remote_filter: str,
    providers: list,
    user_id: int,
    saved_search_id: Optional[int],
    max_results: int = 25,
):
    """Run a job search and upsert results.  Returns (jobs, provider_status, new_count, dupe_count)."""
    from services.job_search_service import JobSearchService

    service = JobSearchService(_db())
    params = _build_search_params(keywords, location, remote_filter, max_results)
    result = service.search(params, user_id=user_id, provider_names=providers)

    jobs = result.get("jobs", [])
    provider_status = result.get("provider_status", {})

    # Attach user/search metadata before upsert
    for job in jobs:
        job["user_id"] = user_id
        job["saved_search_id"] = saved_search_id

    upsert_result = _db().upsert_discovered_jobs(jobs)
    new_count = upsert_result.get("new", 0)
    dupe_count = upsert_result.get("duplicates", 0)

    return jobs, provider_status, new_count, dupe_count


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/provider-status")
async def get_provider_status(user_id: int = Depends(get_current_user_id)):
    """Return rate-limit status + configuration state for all job providers."""
    from services.job_search_service import JobSearchService
    rate_status = _db().get_provider_rate_status(user_id)
    config = JobSearchService().get_provider_config()
    result = {}
    for name, cfg in config.items():
        entry = dict(rate_status.get(name, {'available': True, 'calls_limit': None}))
        entry['configured'] = cfg['configured']
        result[name] = entry
    return result


@router.post("/search")
async def ad_hoc_search(
    request: AdHocSearchRequest,
    user_id: int = Depends(get_current_user_id),
):
    """Run an ad-hoc job search and persist discovered jobs."""
    jobs, provider_status, new_count, dupe_count = _run_search_and_upsert(
        keywords=request.keywords,
        location=request.location,
        remote_filter=request.remote_filter,
        providers=request.providers,
        user_id=user_id,
        saved_search_id=None,
        max_results=request.max_results,
    )
    return {
        "jobs": jobs,
        "provider_status": provider_status,
        "new_count": new_count,
        "dupe_count": dupe_count,
    }


@router.get("/saved-searches")
async def list_saved_searches(user_id: int = Depends(get_current_user_id)):
    """Return all saved searches for the current user."""
    return _db().get_saved_searches(user_id)


@router.post("/saved-searches")
async def create_saved_search(
    body: SavedSearchCreate,
    user_id: int = Depends(get_current_user_id),
):
    """Create a new saved search."""
    return _db().create_saved_search(user_id, body.dict())


@router.put("/saved-searches/{search_id}")
async def update_saved_search(
    search_id: int,
    body: SavedSearchUpdate,
    user_id: int = Depends(get_current_user_id),
):
    """Update fields on an existing saved search (skips None fields)."""
    updates = {k: v for k, v in body.dict().items() if v is not None}
    result = _db().update_saved_search(search_id, user_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return {"ok": True}


@router.delete("/saved-searches/{search_id}")
async def delete_saved_search(
    search_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Delete a saved search."""
    result = _db().delete_saved_search(search_id, user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return {"ok": True}


@router.put("/saved-searches/{search_id}/alerts")
async def toggle_saved_search_alerts(
    search_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Toggle the alerts bell on a saved search."""
    saved = _db().get_saved_search(search_id, user_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved search not found")
    new_val = not saved.get('alerts', False)
    _db().update_saved_search(search_id, user_id, {'alerts': new_val})
    return {"ok": True, "alerts": new_val}


@router.put("/discovered-jobs/{job_id}/restore")
async def restore_discovered_job(
    job_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Un-dismiss a previously dismissed discovered job."""
    _db().update_discovered_job(job_id, user_id, {"is_dismissed": 0})
    return {"ok": True}


@router.post("/saved-searches/{search_id}/run")
async def run_saved_search(
    search_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Execute a saved search, persist results, and log the run."""
    saved = _db().get_saved_search(search_id, user_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Saved search not found")

    jobs, provider_status, new_count, dupe_count = _run_search_and_upsert(
        keywords=saved["keywords"],
        location=saved.get("location", ""),
        remote_filter=saved.get("remote_filter", "any"),
        providers=saved.get("providers", ["adzuna", "jsearch", "themuse", "remoteok"]),
        user_id=user_id,
        saved_search_id=search_id,
        max_results=saved.get("max_results", 25),
    )

    _db().log_search_run(user_id, search_id, {
        "jobs_found": new_count + dupe_count,
        "new_jobs": new_count,
        "status": "success",
    })
    _db().update_saved_search(
        search_id,
        user_id,
        {"last_run_at": datetime.utcnow().isoformat()},
    )

    return {
        "jobs": jobs,
        "provider_status": provider_status,
        "new_count": new_count,
        "dupe_count": dupe_count,
    }


@router.get("/discovered-jobs")
async def list_discovered_jobs(
    search_id: Optional[int] = None,
    is_saved: Optional[bool] = None,
    is_dismissed: Optional[bool] = None,
    min_score: Optional[float] = None,
    user_id: int = Depends(get_current_user_id),
):
    """Return discovered jobs, optionally filtered."""
    filters: dict = {}
    if search_id is not None:
        filters["saved_search_id"] = search_id
    if is_saved is not None:
        filters["is_saved"] = is_saved
    if is_dismissed is not None:
        filters["is_dismissed"] = is_dismissed
    if min_score is not None:
        filters["min_score"] = min_score
    return _db().get_discovered_jobs(user_id, filters)


@router.put("/discovered-jobs/{job_id}/dismiss")
async def dismiss_discovered_job(
    job_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Mark a discovered job as dismissed."""
    _db().update_discovered_job(job_id, user_id, {"is_dismissed": 1})
    return {"ok": True}


@router.put("/discovered-jobs/{job_id}/save")
async def save_discovered_job(
    job_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Mark a discovered job as saved."""
    _db().update_discovered_job(job_id, user_id, {"is_saved": 1})
    return {"ok": True}


@router.post("/discovered-jobs/{job_id}/save-to-pipeline")
async def save_discovered_job_to_pipeline(
    job_id: int,
    force: bool = False,
    user_id: int = Depends(get_current_user_id),
):
    """Create a pipeline application (status=Saved) from a discovered job, without AI processing.

    If an application for the same job already exists and ``force`` is not set,
    returns ``{"ok": False, "duplicate": True, "existing": {...}}`` without
    creating anything, so the client can confirm before saving a second copy.
    """
    job = _db().get_discovered_job(job_id, user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Discovered job not found")

    if not force:
        existing = _db().find_duplicate_application(
            user_id,
            job_url=job.get("url", ""),
            job_title=job.get("title", ""),
            company=job.get("company", ""),
        )
        if existing:
            return {
                "ok": False,
                "duplicate": True,
                "existing": {
                    "id": existing.get("id"),
                    "job_title": existing.get("job_title"),
                    "company": existing.get("company"),
                    "status": existing.get("status"),
                },
            }

    # Map remote_type to location_type used by the application model
    remote_map = {"remote": "Remote", "hybrid": "Hybrid", "onsite": "In Person", "unknown": ""}
    location_type = remote_map.get(job.get("remote_type", ""), "")

    # Format salary range string if available
    salary_range = ""
    if job.get("salary_min") and job.get("salary_max"):
        salary_range = f"${int(job['salary_min']):,} – ${int(job['salary_max']):,}"
    elif job.get("salary_min"):
        salary_range = f"${int(job['salary_min']):,}+"

    app_data = {
        "job_title": job.get("title", "Unknown Role"),
        "company": job.get("company", "Unknown Company"),
        "job_url": job.get("url", ""),
        "apply_url": job.get("url", ""),
        "job_description": job.get("description", ""),
        "location": job.get("location", ""),
        "location_type": location_type,
        "salary_range": salary_range,
        "status": "Saved",
        "source": f"discover:{job.get('source_provider', '')}",
    }

    from main import database_service as db
    app_id = db.save_application(app_data, user_id)

    # Mark discovered job as saved and imported
    _db().update_discovered_job(job_id, user_id, {"is_saved": 1, "is_imported": 1})

    return {"ok": True, "app_id": app_id}


@router.post("/discovered-jobs/{job_id}/import")
async def import_discovered_job(
    job_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Mark a discovered job as imported and return its data for pre-filling a new application."""
    job = _db().get_discovered_job(job_id, user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Discovered job not found")

    _db().update_discovered_job(job_id, user_id, {"is_imported": 1})

    return {
        "ok": True,
        "job": {
            "title": job.get("title"),
            "company": job.get("company"),
            "url": job.get("url"),
            "description": job.get("description"),
            "location": job.get("location"),
            "salary_min": job.get("salary_min"),
            "salary_max": job.get("salary_max"),
        },
    }


@router.post("/discovered-jobs/{job_id}/fetch-description")
async def fetch_full_description(
    job_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Scrape the job's URL to retrieve the full description and cache it in the DB."""
    job = _db().get_discovered_job(job_id, user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Discovered job not found")

    url = job.get("url", "")
    if not url:
        raise HTTPException(status_code=400, detail="No URL available to scrape")

    from services.scraper_service import ScraperService
    scraper = ScraperService()
    try:
        description = await scraper.scrape_job_description(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Scrape failed: {e}")

    if not description or len(description) < 50:
        raise HTTPException(status_code=422, detail="Could not extract description from URL")

    _db().update_discovered_job(job_id, user_id, {"description": description})
    return {"ok": True, "description": description}
