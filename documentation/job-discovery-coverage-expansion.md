# Job Discovery — Coverage Expansion Plan

> **Purpose:** Grow the number of relevant jobs surfaced in Discover. Today's lists are small; this plan layers new sources onto the existing `JobSearchService` provider pattern, prioritizing sources that return the **full job description + metadata in the API** (not the Adzuna teaser+redirect pattern).
>
> **Date:** July 14, 2026
> **Companion analysis:** the full source audit (40+ providers, data-richness, free/paid limits, adversarially verified) is in the published artifact and summarized below.
> **Builds on:** [job_discovery_implementation_plan.md](job_discovery_implementation_plan.md) — this is the concrete "Phase 4 / coverage" work.

---

## The core insight

No single API returns "everything on LinkedIn and Indeed" at a personal-project price — that product is enterprise ($800+/mo, e.g. Coresignal). **Fuller coverage comes from layering** a few complementary feeds and de-duplicating them (we already have `JobSearchService._normalize_url` + `_deduplicate` for this).

A likely large part of the current problem is one number: **JSearch's free tier is 200 requests/month.** If we're on it, that caps us at ~2,000 job-rows/month gross before dedup. Upgrading JSearch to PRO ($25/mo = 10k requests) is the single cheapest coverage bump and requires zero code.

---

## Data-richness verdicts (the priority axis)

| Returns FULL description in-API | Teaser + redirect (deprioritize) |
|---|---|
| JSearch *(current)*, **Fantastic Jobs** (Active Jobs DB + LinkedIn), **TheirStack**, SerpApi Google Jobs, Bright Data, ScrapingDog, Himalayas, Jobicy, Remotive, We Work Remotely, HN "Who is hiring", USAJobs, direct ATS APIs | **Adzuna** *(current)*, Jooble, Careerjet, WhatJobs |

**Dead / avoid:** ZipRecruiter partner API (ZipSearch stopped returning results April 2025); Google Cloud Talent Solution (ranks a corpus you upload — not a source).

---

## Rollout order (cheapest / highest-value first)

1. **JSearch PRO tier** — config only, no code. Removes the 200-req/mo ceiling.
2. **Free-board adapters** — Himalayas, Jobicy, We Work Remotely (+ Remotive, Arbeitnow). Drop-in providers, no keys. §2 below.
3. **Fantastic Jobs — Active Jobs DB** — one paid API (~$1/1k jobs) that includes LinkedIn + full JD, billed via RapidAPI exactly like JSearch. §1 below.
4. **Email job-alert ingestion** — free, ToS-safe LinkedIn/Indeed coverage using the user's own alerts. §3 below.
5. **Direct-ATS enumeration** — expand the company→board-token corpus feeding the ATS adapters the backend already has (biggest free win; separate follow-up).
6. **In-browser Voyager capture** — extension work, tracked separately.

Everything in §1–§2 slots into the existing `JobSearchService.providers` list and needs no schema or route changes — providers return `JobListing` objects; the service handles dedup + `upsert_discovered_jobs`.

---

## §1 — FantasticJobsProvider (full JD, includes LinkedIn)

Same shape as `JSearchProvider` (RapidAPI key + header auth). **Critical gotcha:** you must pass `description_type=text` or the response contains no description.

```python
# backend/services/job_search_service.py

FANTASTIC_JOBS_KEY = os.getenv("FANTASTIC_JOBS_KEY", "")


class FantasticJobsProvider:
    """Fantastic Jobs 'Active Jobs DB' via RapidAPI.

    Full job descriptions + rich company/LinkedIn metadata. Sources 200k+ ATS
    and career sites plus major boards INCLUDING LinkedIn (no Indeed).
    Billing is per-job (~$1 / 1,000). The window budget below is a coarse
    per-CALL guard, not the job quota — keep `limit` modest and rely on the
    RapidAPI plan's job cap as the real limit.
    """
    name = "fantastic_jobs"
    BASE_URL = "https://active-jobs-db.p.rapidapi.com/active-ats-7d"
    RAPIDAPI_HOST = "active-jobs-db.p.rapidapi.com"

    def is_available(self, rate_status: dict) -> bool:
        if not FANTASTIC_JOBS_KEY:
            return False
        status = rate_status.get(self.name, {})
        for window_type, limit in self.get_windows():
            if status.get(window_type, 0) >= limit:
                return False
        return True

    def get_windows(self) -> list:
        # Coarse call budget. ~1 call per search; adjust to your RapidAPI plan.
        return [("day", 40), ("month", 500)]

    def search(self, params: SearchParams) -> list:
        query_params = {
            "title_filter": params.keywords,
            "description_type": "text",          # <-- REQUIRED or description is empty
            "limit": min(params.max_results, 100),  # RapidAPI caps at 100/call
            "offset": 0,
        }
        if params.location:
            query_params["location_filter"] = params.location
        if params.remote_filter == "remote":
            query_params["remote"] = "true"

        headers = {
            "X-RapidAPI-Key": FANTASTIC_JOBS_KEY,
            "X-RapidAPI-Host": self.RAPIDAPI_HOST,
        }

        try:
            response = httpx.get(self.BASE_URL, params=query_params, headers=headers, timeout=15)
            response.raise_for_status()
            data = response.json()  # NOTE: response is a JSON *array* of jobs
        except Exception as e:
            logger.error(f"FantasticJobsProvider search error: {e}")
            return []

        results = []
        for item in (data or []):
            # Field names below reflect the Active Jobs DB schema as of 2026-07;
            # confirm against a live response — this vendor evolves field names.
            locations = item.get("locations_derived") or item.get("locations_raw") or []
            location = ", ".join(locations) if isinstance(locations, list) else str(locations or "")

            is_remote = bool(item.get("remote_derived"))
            remote_type = "remote" if is_remote else _detect_remote_type_from_text(
                item.get("title", ""), item.get("description", "")
            )

            salary_min, salary_max, currency = self._parse_salary(item.get("salary_raw"))

            results.append(JobListing(
                external_id=str(item.get("id", "")),
                source_provider=self.name,
                url=item.get("url", ""),
                title=item.get("title", ""),
                company=item.get("organization", "") or item.get("organization_name", ""),
                location=location,
                remote_type=remote_type,
                salary_min=salary_min,
                salary_max=salary_max,
                salary_currency=currency,
                description=item.get("description", "") or "",
                raw_data=item,
            ))
        return results

    @staticmethod
    def _parse_salary(salary_raw):
        """salary_raw is a schema.org-style MonetaryAmount object (or None)."""
        if not isinstance(salary_raw, dict):
            return None, None, None
        value = salary_raw.get("value", {}) if isinstance(salary_raw.get("value"), dict) else {}
        def _f(v):
            try:
                return float(v)
            except (TypeError, ValueError):
                return None
        return _f(value.get("minValue")), _f(value.get("maxValue")), salary_raw.get("currency")
```

> **TheirStack** (the one provider covering LinkedIn **and** Indeed with full JD) follows the same shape but hits `https://api.theirstack.com/v1/jobs/search` with a `Bearer` token and a POST body of filters. Its free tier (200 credits/mo, no expiry; 1 credit = 1 job) can even run low-volume for free. Add it as a second `TheirStackProvider` if Indeed coverage specifically matters.

---

## §2 — Free-board adapters (no key, full JD)

These mirror `RemoteOKProvider` / `TheMuseProvider`: `is_available` returns `True`, `get_windows()` returns `[]` (no rate tracking), and keyword filtering is client-side. They're remote-focused — they won't fill the LinkedIn/Indeed gap, but they grow the list the most for $0.

```python
class HimalayasProvider:
    """Himalayas remote-jobs API. Free, no key. Largest free index (~106k).
    Full HTML description + salary. Caps at 20 jobs/request, so paginate."""
    name = "himalayas"
    BASE_URL = "https://himalayas.app/jobs/api"

    def is_available(self, rate_status: dict) -> bool:
        return True

    def get_windows(self) -> list:
        return []

    def search(self, params: SearchParams) -> list:
        if params.remote_filter not in ("any", "remote"):
            return []
        keywords = [k.strip().lower() for k in params.keywords.split() if k.strip()]
        results, offset, pages = [], 0, 0
        while pages < 5 and len(results) < params.max_results:  # 5 pages * 20 = up to 100
            try:
                resp = httpx.get(self.BASE_URL, params={"limit": 20, "offset": offset}, timeout=10)
                resp.raise_for_status()
                jobs = resp.json().get("jobs", [])
            except Exception as e:
                logger.error(f"HimalayasProvider search error: {e}")
                break
            if not jobs:
                break
            for item in jobs:
                title = item.get("title", "")
                desc = item.get("description", "")
                if keywords and not any(k in (title + " " + desc).lower() for k in keywords):
                    continue
                results.append(JobListing(
                    external_id=str(item.get("guid") or item.get("id", "")),
                    source_provider=self.name,
                    url=item.get("applicationLink") or item.get("url", ""),
                    title=title,
                    company=item.get("companyName", ""),
                    location=", ".join(item.get("locationRestrictions", []) or []) or "Remote",
                    remote_type="remote",
                    salary_min=item.get("minSalary"),
                    salary_max=item.get("maxSalary"),
                    salary_currency=item.get("salaryCurrency", "USD"),
                    description=desc,
                    raw_data=item,
                ))
            offset += 20
            pages += 1
        return results[:params.max_results]


class JobicyProvider:
    """Jobicy remote-jobs API v2. Free, no key. Up to 100 jobs/call, full JD."""
    name = "jobicy"
    BASE_URL = "https://jobicy.com/api/v2/remote-jobs"

    def is_available(self, rate_status: dict) -> bool:
        return True

    def get_windows(self) -> list:
        return []

    def search(self, params: SearchParams) -> list:
        if params.remote_filter not in ("any", "remote"):
            return []
        try:
            resp = httpx.get(self.BASE_URL, params={"count": 100}, timeout=10)
            resp.raise_for_status()
            jobs = resp.json().get("jobs", [])
        except Exception as e:
            logger.error(f"JobicyProvider search error: {e}")
            return []
        keywords = [k.strip().lower() for k in params.keywords.split() if k.strip()]
        results = []
        for item in jobs:
            title = item.get("jobTitle", "")
            desc = item.get("jobDescription", "") or item.get("jobExcerpt", "")
            if keywords and not any(k in (title + " " + desc).lower() for k in keywords):
                continue
            results.append(JobListing(
                external_id=str(item.get("id", "")),
                source_provider=self.name,
                url=item.get("url", ""),
                title=title,
                company=item.get("companyName", ""),
                location=item.get("jobGeo", "") or "Remote",
                remote_type="remote",
                salary_min=item.get("annualSalaryMin"),
                salary_max=item.get("annualSalaryMax"),
                salary_currency=item.get("salaryCurrency", "USD"),
                description=desc,
                raw_data=item,
            ))
        return results[:params.max_results]


class WeWorkRemotelyProvider:
    """We Work Remotely via RSS. Free. Full description in the feed; no salary.
    Only recent items per feed, so poll frequently (fits the Phase 2 daily sweep)."""
    name = "weworkremotely"
    FEED_URL = "https://weworkremotely.com/remote-jobs.rss"

    def is_available(self, rate_status: dict) -> bool:
        return True

    def get_windows(self) -> list:
        return []

    def search(self, params: SearchParams) -> list:
        if params.remote_filter not in ("any", "remote"):
            return []
        try:
            resp = httpx.get(self.FEED_URL, headers={"User-Agent": "JobKernel/1.0"}, timeout=10)
            resp.raise_for_status()
        except Exception as e:
            logger.error(f"WeWorkRemotelyProvider search error: {e}")
            return []

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "xml")
        keywords = [k.strip().lower() for k in params.keywords.split() if k.strip()]
        results = []
        for item in soup.find_all("item"):
            raw_title = item.title.get_text(strip=True) if item.title else ""
            # WWR titles are "Company: Role"
            company, _, title = raw_title.partition(":")
            title = (title or raw_title).strip()
            desc = item.description.get_text(strip=True) if item.description else ""
            if keywords and not any(k in (title + " " + desc).lower() for k in keywords):
                continue
            link = item.link.get_text(strip=True) if item.link else ""
            results.append(JobListing(
                external_id=link,
                source_provider=self.name,
                url=link,
                title=title,
                company=company.strip(),
                location="Remote",
                remote_type="remote",
                salary_min=None, salary_max=None, salary_currency=None,
                description=desc,
                raw_data={"title": raw_title, "link": link},
            ))
        return results[:params.max_results]
```

> **Remotive** (`https://remotive.com/api/remote-jobs`) and **Arbeitnow** (`https://www.arbeitnow.com/api/job-board-api`) are near-identical JSON variants — copy `JobicyProvider` and remap field names. Remotive is rate-capped, so cache once/day into `discovered_jobs` rather than calling it live per query.

### Wiring §1–§2

```python
# JobSearchService.__init__
self.providers = [
    AdzunaProvider(),
    JSearchProvider(),
    FantasticJobsProvider(),   # NEW — full JD, includes LinkedIn
    TheMuseProvider(),
    RemoteOKProvider(),
    HimalayasProvider(),       # NEW
    JobicyProvider(),          # NEW
    WeWorkRemotelyProvider(),  # NEW
]

# get_provider_config() — add entries so the frontend chips render
'fantastic_jobs': {'configured': bool(os.getenv('FANTASTIC_JOBS_KEY'))},
'himalayas':      {'configured': True},
'jobicy':         {'configured': True},
'weworkremotely': {'configured': True},
```

Also add `FANTASTIC_JOBS_KEY=` to `backend/.env.example`, and add the new provider names to the default `providers` lists in `routes/job_search.py` (the `SavedSearchCreate` / `AdHocSearchRequest` defaults) if you want them on by default. The `/provider-status` endpoint and Discover chips derive automatically from `get_provider_config()`.

---

## §3 — Email job-alert ingestion (free, ToS-safe LinkedIn/Indeed)

Have the user create LinkedIn / Indeed / Glassdoor **job alerts** delivered to their inbox. A backend IMAP job reads those alert emails and turns them into discovered jobs. This is fully automated, uses the user's *own* subscription (no scraping, no ban risk), and pulls exactly the boards we can't reach via API. Alert emails are teasers → enrich each via the **existing** `scraper_service` / `POST /discovered-jobs/{id}/fetch-description`.

The repo already runs **DavMail** (`davmail.log`), which exposes local IMAP (default `localhost:1143`) — point the service at it, or at any IMAP host.

```python
# backend/services/job_alert_email_service.py  (NEW)
import email
import imaplib
import logging
import os
import re
from email.header import decode_header
from urllib.parse import urlparse, urlunparse

from bs4 import BeautifulSoup

logger = logging.getLogger("app")

IMAP_HOST = os.getenv("JOB_ALERT_IMAP_HOST", "localhost")
IMAP_PORT = int(os.getenv("JOB_ALERT_IMAP_PORT", "1143"))   # DavMail default
IMAP_USER = os.getenv("JOB_ALERT_IMAP_USER", "")
IMAP_PASS = os.getenv("JOB_ALERT_IMAP_PASS", "")

# One parser per sender. Alert-email markup changes periodically — keep these
# tolerant and treat a parse miss as "skip", never a crash.
ALERT_SENDERS = {
    "linkedin": ["jobalerts-noreply@linkedin.com", "jobs-noreply@linkedin.com"],
    "indeed":   ["alert@indeed.com", "donotreply@match.indeed.com"],
    "glassdoor": ["noreply@glassdoor.com"],
}


class JobAlertEmailService:
    def __init__(self, database_service):
        self.db = database_service

    def is_configured(self) -> bool:
        return bool(IMAP_USER and IMAP_PASS)

    def ingest(self, user_id: int, mark_seen: bool = True) -> dict:
        """Fetch unread job-alert emails and upsert them as discovered jobs.
        Returns {"new": int, "duplicates": int, "emails": int}."""
        if not self.is_configured():
            return {"new": 0, "duplicates": 0, "emails": 0, "error": "IMAP not configured"}

        listings, seen_emails = [], 0
        try:
            imap = imaplib.IMAP4(IMAP_HOST, IMAP_PORT)  # use IMAP4_SSL for a real remote host
            imap.login(IMAP_USER, IMAP_PASS)
            imap.select("INBOX")
            for source, senders in ALERT_SENDERS.items():
                for sender in senders:
                    typ, data = imap.search(None, f'(UNSEEN FROM "{sender}")')
                    if typ != "OK":
                        continue
                    for num in data[0].split():
                        typ, msg_data = imap.fetch(num, "(RFC822)")
                        if typ != "OK":
                            continue
                        msg = email.message_from_bytes(msg_data[0][1])
                        html = self._extract_html(msg)
                        if html:
                            listings.extend(self._parse(source, html, user_id))
                            seen_emails += 1
                        if mark_seen:
                            imap.store(num, "+FLAGS", "\\Seen")
            imap.logout()
        except Exception as e:
            logger.error(f"JobAlertEmailService.ingest error: {e}")
            return {"new": 0, "duplicates": 0, "emails": seen_emails, "error": str(e)}

        result = self.db.upsert_discovered_jobs(listings)
        result["emails"] = seen_emails
        return result

    # ---- helpers ---------------------------------------------------------

    def _extract_html(self, msg) -> str:
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/html":
                    return part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "ignore")
            return ""
        if msg.get_content_type() == "text/html":
            return msg.get_payload(decode=True).decode(msg.get_content_charset() or "utf-8", "ignore")
        return ""

    def _parse(self, source: str, html: str, user_id: int) -> list:
        """Pull (title, company, url) tuples out of an alert email into
        discovered-job dicts (teasers — description enriched later)."""
        soup = BeautifulSoup(html, "html.parser")
        jobs, seen = [], set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not self._is_job_link(source, href):
                continue
            url = self._clean_url(source, href)
            if not url or url in seen:
                continue
            seen.add(url)
            title = a.get_text(strip=True)
            if not title or len(title) < 3:
                continue
            jobs.append({
                "user_id": user_id,
                "saved_search_id": None,
                "source_provider": f"email:{source}",
                "external_id": url,
                "url": url,
                "title": title,
                "company": self._company_near(a),
                "location": "",
                "remote_type": "unknown",
                "description": "",          # teaser — enrich via scraper_service
                "raw_data": {"source": source},
            })
        return jobs

    @staticmethod
    def _is_job_link(source: str, href: str) -> bool:
        patterns = {
            "linkedin": ["linkedin.com/comm/jobs/view/", "linkedin.com/jobs/view/"],
            "indeed":   ["indeed.com/rc/clk", "indeed.com/viewjob", "indeed.com/pagead"],
            "glassdoor": ["glassdoor.com/job-listing", "glassdoor.com/partner"],
        }
        return any(p in href for p in patterns.get(source, []))

    @staticmethod
    def _clean_url(source: str, href: str):
        """Strip tracking params; normalize LinkedIn /comm/jobs/view -> /jobs/view."""
        try:
            p = urlparse(href)
            path = p.path.replace("/comm/jobs/", "/jobs/") if source == "linkedin" else p.path
            return urlunparse((p.scheme, p.netloc, path, "", "", ""))
        except Exception:
            return href

    @staticmethod
    def _company_near(anchor) -> str:
        """Best-effort: company name is usually a sibling/nearby node in the card."""
        parent = anchor.find_parent(["td", "div", "tr"])
        if parent:
            txt = parent.get_text(" ", strip=True)
            m = re.search(r"·\s*([^·\n]{2,60})", txt)  # "Role · Company · Location"
            if m:
                return m.group(1).strip()
        return ""
```

**Wiring §3:**

1. Env: `JOB_ALERT_IMAP_HOST/PORT/USER/PASS` in `backend/.env.example`.
2. Manual trigger endpoint in `routes/job_search.py`:
   ```python
   @router.post("/ingest-email-alerts")
   async def ingest_email_alerts(user_id: int = Depends(get_current_user_id)):
       from services.job_alert_email_service import JobAlertEmailService
       return JobAlertEmailService(_db()).ingest(user_id)
   ```
3. Daily sweep: call `JobAlertEmailService(db).ingest(user_id)` inside the existing background loop (`main.py` `run_maintenance_loop`, alongside the planned Phase-2 discovery sweep), then optionally loop the new teaser rows through `scraper_service.scrape_job_description(url)` to backfill descriptions, and `create_notification(...)` when `new > 0`.
4. Enrichment reuses the existing `POST /discovered-jobs/{id}/fetch-description` path — no new scraping code.

**Caveats:** alert-email HTML changes periodically, so keep parsers tolerant and log misses; LinkedIn/Indeed links are teasers (title + company + URL), so descriptions/salary require the enrichment pass; dedup is automatic via `upsert_discovered_jobs` (url + user_id).

---

## What this adds up to

| Source | Cost | Fills LinkedIn/Indeed? | Effort |
|--------|------|------------------------|--------|
| JSearch PRO | $25/mo | Yes (via Google Jobs) | none (config) |
| Fantastic Jobs | ~$1/1k jobs | LinkedIn + ATS | low (1 provider class) |
| Free boards ×3–5 | free | no (remote breadth) | low (copy pattern) |
| Email alerts | free | **yes, exactly** | medium (new service) |
| Direct-ATS expansion | free | upstream of both | medium (corpus building) |

Deduplicated by normalized URL across all of them. Start with rows 1–3 (a few hours against the existing provider pattern); rows 4–5 are the free routes that specifically close the LinkedIn/Indeed gap.

---

*Related: [job_discovery_implementation_plan.md](job_discovery_implementation_plan.md) · [crawl4ai-scraping-evaluation.md](crawl4ai-scraping-evaluation.md)*
