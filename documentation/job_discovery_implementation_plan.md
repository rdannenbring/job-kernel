# Job Discovery — Implementation Plan

> **Purpose:** Integrate job listing APIs to automatically surface matching jobs for users, with saved searches, daily auto-checks, in-app notifications, and optional AI scoring.
> **Date:** June 6, 2026 | **Last updated:** June 7, 2026
> **Research source:** [job_listing_api_research.md](../job_listing_api_research.md) (in Gemini brain)
>
> **User decisions from research Q&A:**
> - Geography: US first, international later
> - Job type: Mixed (local / remote / hybrid) — user-defined per search
> - Volume: Variable (user may run more than 3 searches/day) + 1 automatic daily check with in-app notifications
> - AI Matching: Toggle per search + global default set during onboarding
> - MCP: Definitely exploring (Phase 4)
> - Budget: Free-only for now; paid service account integration planned for future

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1** | ✅ Complete | Shipped June 7, 2026 |
| **Phase 2** | ⬜ Not started | Daily auto-sweep + notifications |
| **Phase 3** | ⬜ Not started | AI scoring per job |
| **Phase 4** | ⬜ Not started | JobSpy, USAJobs, key management UI |

### Phase 1 — What was actually built (deviations from plan noted)

**Backend:**
- `backend/services/database_service.py` — 4 new ORM tables + 10 CRUD methods
- `backend/services/job_search_service.py` — JobSearchService + 4 provider adapters
  - **JSearch deviation:** Uses `api.openwebninja.com/jsearch/search-v2` with `X-API-Key` header (not RapidAPI as originally planned)
  - Provider config status (`get_provider_config()`) exposes whether env vars are set, used by frontend chips
- `backend/routes/job_search.py` — 12 endpoints under `/api/job-discovery/`
  - Includes `POST /discovered-jobs/{id}/save-to-pipeline` (creates Saved-stage application without AI)
  - Includes `POST /discovered-jobs/{id}/import` (localStorage bridge → NewApplication with URL pre-filled)
- `backend/main.py` — router registered

**Frontend:**
- `frontend/src/pages/Discover.jsx` + `Discover.css`
  - Provider status bar (green/warning/exhausted/unconfigured chips)
  - Saved searches sidebar: create, edit (modal), delete (inline confirm), run individual
  - "Run All Now" runs all active saved searches
  - Ad-hoc search bar (keywords + location + remote filter)
  - Job cards: Process Now / Save / Dismiss
    - **Process Now** → localStorage bridge to NewApplication (pre-fills job URL)
    - **Save** → creates Saved-stage pipeline entry immediately, no AI processing
    - **Dismiss** → hides from list, recoverable via "Show dismissed" toggle
  - Click-to-expand job detail panel (right side, shows full description + action buttons)
  - Deduplication: within-response (by URL) + DB-query (by title+company+source)
  - Toast notifications for all actions + search result counts
- `frontend/src/components/Layout/Sidebar.jsx` — "Discover" nav item (icon: `travel_explore`)
- `frontend/src/App.jsx` — discover screen + hash routing

**API keys configured in `backend/.env`** (never commit real values — see `backend/.env.example`):
- `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` — free tier at https://developer.adzuna.com/
- `JSEARCH_KEY` — from https://www.openwebninja.com/ (note: **not** RapidAPI; see the JSearch deviation above)
- TheMuse and RemoteOK require no keys

> `backend/.env` is gitignored. This repo is **public** — keep credentials out of tracked files, including documentation.

**Open questions resolved:**
1. API keys stored in `.env` for now; Settings UI deferred to Phase 4
2. "Process Now" pre-fills URL in NewApplication form; "Save" creates pipeline entry directly
3. Discover is a top-level nav item between Dashboard and Profile
4. Daily sweep deferred to Phase 2

**Known remaining UX work (flagged for design pass):**
- Job card information density — needs layout polish
- Detail panel design — full description readability
- Provider status chips — sizing and placement
- Empty states and loading states could be more polished
- Mobile/responsive layout not yet addressed

---

## Architecture Overview

```
User Profile (skills, location, preferences)
        │
        ▼
┌─────────────────────────────────────────┐
│   SavedSearch (user-defined criteria)   │
│   name, keywords, location, remote      │
│   filter, providers, ai_scoring toggle  │
└────────────┬────────────────────────────┘
             │ runs on demand + daily cron
             ▼
┌─────────────────────────────────────────┐
│   JobSearchService (new)                │
│   ┌──────────┐  ┌──────────┐           │
│   │ Adzuna   │  │ JSearch  │           │
│   └──────────┘  └──────────┘           │
│   ┌──────────┐  ┌──────────┐           │
│   │ The Muse │  │ RemoteOK │           │
│   └──────────┘  └──────────┘           │
│   Deduplication by normalized URL       │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   AI Scoring Layer (optional)           │
│   existing ai_service.py               │
│   score_job_for_profile() → 0–100      │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   discovered_jobs table (cache)         │
│   + Notification via existing system    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   Discover Page (new frontend page)     │
│   Job cards, match scores, filters      │
│   Save / Dismiss / Import to Pipeline  │
└─────────────────────────────────────────┘
```

---

## Phase 1: Search Infrastructure (Foundation)
**Goal:** Users can run manual searches and see results. No automation yet.

### 1.1 Database Models
**File:** `backend/services/database_service.py`

Add three new tables via SQLAlchemy ORM + migration SQL:

**`saved_searches`**
```
id              INTEGER PK
user_id         INTEGER FK → users
name            TEXT           ("Senior Backend Engineer - Chicago")
keywords        TEXT           ("python fastapi backend")
location        TEXT           ("Chicago, IL")
remote_filter   TEXT           ("any" | "remote" | "local" | "hybrid")
providers       TEXT           JSON array: ["adzuna", "jsearch", "themuse", "remoteok"]
ai_scoring      INTEGER        0 or 1 (toggleable per search)
is_active       INTEGER        1 = included in daily sweep
last_run_at     TEXT           ISO timestamp
created_at      TEXT           ISO timestamp
```

**`discovered_jobs`**
```
id              INTEGER PK
user_id         INTEGER FK → users
saved_search_id INTEGER FK → saved_searches (nullable — for ad-hoc results)
source_provider TEXT           ("adzuna", "jsearch", "themuse", "remoteok")
external_id     TEXT           provider's own job ID (for dedup within provider)
url             TEXT UNIQUE    normalized apply URL — primary dedup key across providers
title           TEXT
company         TEXT
location        TEXT
remote_type     TEXT           ("remote" | "hybrid" | "onsite" | "unknown")
salary_min      REAL
salary_max      REAL
salary_currency TEXT
description     TEXT           full job description text
ai_match_score  REAL           0.0–100.0, NULL if not scored
ai_match_summary TEXT          2–3 sentence explanation from AI
raw_data        TEXT           JSON blob of original API response
discovered_at   TEXT           ISO timestamp
is_dismissed    INTEGER        0 or 1
is_saved        INTEGER        0 or 1 (user bookmarked)
is_imported     INTEGER        0 or 1 (converted to application in pipeline)
```

**`search_run_log`**
```
id              INTEGER PK
saved_search_id INTEGER FK → saved_searches (nullable for ad-hoc)
user_id         INTEGER
run_at          TEXT           ISO timestamp
jobs_found      INTEGER        total returned by APIs
new_jobs        INTEGER        net-new after dedup
status          TEXT           ("success" | "partial" | "error")
error_message   TEXT           nullable
```

**`provider_rate_limit_log`**
```
id              INTEGER PK
user_id         INTEGER
provider        TEXT           ("adzuna", "jsearch", "themuse", "remoteok")
window_type     TEXT           ("minute" | "hour" | "day" | "week" | "month")
window_start    TEXT           ISO timestamp — start of the current window
calls_used      INTEGER        calls consumed in this window
calls_limit     INTEGER        max calls allowed in this window
last_called_at  TEXT           ISO timestamp
```

This table drives the provider status UI and lets the service skip exhausted providers gracefully. Each provider adapter updates its row(s) after every call. `window_start` resets when `now > window_start + window_duration`.

**Known free-tier limits to track (per provider):**

| Provider | Window | Limit |
|----------|--------|-------|
| Adzuna | Day | 250 |
| Adzuna | Week | 1,000 |
| Adzuna | Month | 2,500 |
| JSearch | Month | ~1,000 (varies by RapidAPI plan) |
| The Muse | Hour | 3,600 |
| RemoteOK | — | No documented limit — skip tracking |
| Remotive | Day | 4 |

> **Note:** The Muse and RemoteOK limits are generous/absent, so they will almost never show as exhausted. Adzuna's 250/day and JSearch's monthly cap are the ones users are most likely to hit.

**New CRUD methods to add:**
- `create_saved_search(user_id, data)` → dict
- `get_saved_searches(user_id)` → list
- `update_saved_search(id, user_id, data)` → bool
- `delete_saved_search(id, user_id)` → bool
- `upsert_discovered_jobs(jobs: list[dict])` → (new_count, dupe_count)
- `get_discovered_jobs(user_id, filters)` → list  (filters: saved_search_id, is_dismissed, is_saved, min_score)
- `update_discovered_job(id, user_id, data)` → bool
- `log_search_run(saved_search_id, user_id, stats)` → id
- `get_provider_rate_status(user_id)` → dict  (keyed by provider name — see below)
- `increment_provider_usage(user_id, provider, window_type)` → None  (called by each provider adapter after a successful API call)

---

### 1.2 Job Search Service
**New file:** `backend/services/job_search_service.py`

```python
class JobSearchProvider(ABC):
    name: str
    def search(self, params: SearchParams) -> list[JobListing]: ...

class SearchParams:
    keywords: str
    location: str
    remote_filter: str  # "any" | "remote" | "local" | "hybrid"
    max_results: int = 25

class JobListing:
    external_id: str
    source_provider: str
    url: str            # normalized apply URL
    title: str
    company: str
    location: str
    remote_type: str
    salary_min: float | None
    salary_max: float | None
    salary_currency: str | None
    description: str
    raw_data: dict

class JobSearchService:
    def search(self, params, providers=None) -> list[JobListing]: ...
    def _deduplicate(self, listings) -> list[JobListing]: ...
    def _normalize_url(self, url) -> str: ...
```

**Providers to implement in Phase 1:**

| Class | API | Key required? | Notes |
|-------|-----|---------------|-------|
| `AdzunaProvider` | Adzuna | Yes (app_id + app_key) | 250/day free. Best salary data. |
| `JSearchProvider` | JSearch/RapidAPI | Yes (RapidAPI key) | ~100-1K/month free. Most comprehensive. Cache aggressively. |
| `TheMuseProvider` | The Muse | Optional | 3,600/hr with key. No auth needed to start. |
| `RemoteOKProvider` | RemoteOK | None | Unlimited. Client-side filter for keywords. Remote-only. |

**Rate limit enforcement in `JobSearchService`:**

Before calling any provider, the service checks `get_provider_rate_status()`. If a provider's most restrictive window is exhausted, it is **skipped silently** for that request — other available providers still run. The service returns a `provider_status` dict alongside results so the frontend can show the right messaging.

```python
# provider_status shape returned with every search response:
{
  "adzuna": {
    "available": False,
    "exhausted_window": "day",
    "calls_used": 250,
    "calls_limit": 250,
    "resets_at": "2026-06-07T00:00:00",   # ISO — window_start + window_duration
    "resets_in_human": "in 6 hours"        # computed from resets_at
  },
  "jsearch": {
    "available": True,
    "exhausted_window": None,
    "calls_used": 312,
    "calls_limit": 1000,
    "resets_at": "2026-07-01T00:00:00",
    "resets_in_human": "in 24 days"
  },
  "themuse":   { "available": True, ... },
  "remoteok":  { "available": True, "calls_limit": None }  # no limit
}
```

**API keys storage:** User-configurable via `ui_config` JSON in `Config` table:
```json
{
  "job_discovery": {
    "ai_scoring_default": true,
    "providers_enabled": ["adzuna", "jsearch", "themuse", "remoteok"],
    "api_keys": {
      "adzuna_app_id": "",
      "adzuna_app_key": "",
      "jsearch_key": "",
      "themuse_key": ""
    }
  }
}
```

> **Note on JSearch rate limits:** With 1K/month free and daily auto-checks for up to 5 saved searches, budget ~5 calls/day × 30 = 150 calls/month. Fine. Cache results in `discovered_jobs` — never re-fetch a URL already in the table.

---

### 1.3 Backend Routes
**New file:** `backend/routes/job_search.py` — register in `main.py` as `app.include_router(...)`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/job-search/search` | Ad-hoc search (not saved). Returns `JobListing[]`. |
| `GET` | `/api/saved-searches` | List all saved searches for user. |
| `POST` | `/api/saved-searches` | Create a saved search. |
| `PUT` | `/api/saved-searches/{id}` | Update name/params/ai_scoring/is_active. |
| `DELETE` | `/api/saved-searches/{id}` | Delete. |
| `POST` | `/api/saved-searches/{id}/run` | Run a saved search now → stores results, returns new jobs. |
| `GET` | `/api/discovered-jobs` | List discovered jobs. Query params: `search_id`, `is_saved`, `is_dismissed`, `min_score`. |
| `PUT` | `/api/discovered-jobs/{id}/dismiss` | Mark dismissed. |
| `PUT` | `/api/discovered-jobs/{id}/save` | Bookmark. |
| `POST` | `/api/discovered-jobs/{id}/import` | Create a new application from this job (pre-fills title, company, URL, description → triggers existing scraper flow). |

---

### 1.4 Frontend — Discover Page
**New file:** `frontend/src/pages/Discover.jsx`

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Discover Jobs                          [+ New Search]│
├──────────────────┬──────────────────────────────────┤
│                  │                                   │
│  Saved Searches  │  Job Results                      │
│  ─────────────   │  ─────────────────────────────── │
│  ○ Senior BE     │  ┌─────────────────────────────┐  │
│    Chicago       │  │ Software Engineer @ Stripe  │  │
│    Last: 2h ago  │  │ Chicago, IL · Hybrid        │  │
│                  │  │ $140k–$180k                 │  │
│  ○ Remote Python │  │ AI Match: 87%  ●●●●○        │  │
│    Any location  │  │ [Import]  [Save]  [Dismiss]  │  │
│    Last: 1d ago  │  └─────────────────────────────┘  │
│                  │  ┌─────────────────────────────┐  │
│  [Run All Now]   │  │ Backend Eng @ Twilio        │  │
│                  │  │ Remote · $120k–$160k        │  │
│                  │  │ AI Match: 74%  ●●●○○        │  │
│                  │  │ [Import]  [Save]  [Dismiss]  │  │
│                  │  └─────────────────────────────┘  │
└──────────────────┴──────────────────────────────────┘
```

**Provider status bar:**

A compact row of provider chips sits above the search results. Each chip shows the provider name, its current availability, and — when limited — the reset time. No blocking UI; it's purely informational.

```
Sources:  [✓ The Muse]  [✓ RemoteOK]  [⚠ Adzuna — limit reached, resets in 6h]  [⚠ JSearch — 312/1,000 this month]
```

Chip states:
- **Available** (green dot + provider name) — calls remaining, no action needed
- **Nearing limit** (yellow dot) — e.g. >80% of monthly quota used; no action, just a heads-up
- **Exhausted** (grey + strikethrough) — shows `"resets_in_human"` text from the API response. Clicking the chip expands a small tooltip with exact reset timestamp and the limit that was hit (e.g. "250/day — resets at midnight UTC")
- **No limit** (RemoteOK) — shown as available, no usage counter displayed

The provider status is returned with every `/api/job-search/search` and `/api/saved-searches/{id}/run` response, so the bar always reflects the current state after each search.

**Key behaviors:**
- Selecting a saved search filters results to that search
- "Ad-hoc search" bar at top runs instant searches not tied to saved searches
- Import button pre-fills a new application using the job's title/company/URL/description — calls existing `POST /api/applications` endpoint (same as NewApplication.jsx flow) — the scraper will enrich it further
- Match score only shown if `ai_scoring = true` on that search
- Dismissed jobs hidden by default with a "Show dismissed" toggle
- If **all** providers are exhausted, the search button is disabled and replaced with an inline message: "All sources are at their daily/monthly limit. [Provider name] resets [soonest reset time]." — this is the only case where a limit actively blocks a search

**Sidebar nav:** Add "Discover" entry between "Dashboard" and "Analytics" in `App.jsx` / `Sidebar.jsx`

---

## Phase 2: Daily Auto-Check + Notifications
**Goal:** Saved searches run automatically each day. Users get bell notifications for new matches.

### 2.1 Extend Background Scheduler
**File:** `backend/main.py` — existing `background_maintenance_thread` function

The existing scheduler pattern (lines ~121–174) already loops with `time.sleep()` and reads config. Add a new check block for job discovery:

```python
# Job Discovery auto-sweep — runs daily
discovery_config = config.get('job_discovery', {})
if discovery_config.get('auto_sweep_enabled', True):
    last_sweep = discovery_config.get('last_sweep')
    # Run once per day, defaulting to 7am user local time
    # (simplification: run when process wakes near the daily mark)
    if should_run_daily(last_sweep, target_hour=7):
        run_job_discovery_sweep()
        discovery_config['last_sweep'] = now.isoformat()
        config['job_discovery'] = discovery_config
        database_service.save_config(config, None)
```

**`run_job_discovery_sweep()` logic:**
1. Get all users with active saved searches
2. For each user → get their `saved_searches` where `is_active = 1`
3. Run each search via `JobSearchService`
4. Upsert results into `discovered_jobs` (dedup by URL)
5. If `new_jobs > 0` → emit notification
6. Log to `search_run_log`

### 2.2 Notifications
Reuse the existing `create_notification()` pattern from `database_service.py`:

```python
database_service.create_notification(
    user_id=user_id,
    title=f"{new_count} new jobs matching '{search.name}'",
    message=f"Found on {', '.join(providers_used)}. Click to review.",
    category="info",
    link_screen="discover",
    link_app_id=None,
)
```

**Frontend click-through:** In `App.jsx`, extend the notification navigation handler to recognize `link_screen = "discover"` and route to `/discover` (optionally with a `?search_id=X` query param to pre-select the right saved search).

### 2.3 Settings Toggle
**File:** `frontend/src/pages/Settings.jsx`

Add a "Job Discovery" section to Settings with:
- Auto-sweep enabled toggle (on/off)
- Preferred sweep time (hour selector, default 7am)
- API key entry fields for Adzuna, JSearch, The Muse (masked input + save)

> **Note (2026-07):** Settings has since gained a **Workflow** tab, and behavior preferences are persisted under a `workflow_config` key in the `configs.settings` blob, as a sibling of `ui_config` (see [`product-direction.md`](product-direction.md) §3). Follow that structure and the existing per-tab save convention when adding these controls; do not invent a third persistence mechanism.

---

## Phase 3: AI Matching
**Goal:** Jobs get scored against the user's profile. Toggle per search and via global default.

### 3.1 New AI Method
**File:** `backend/services/ai_service.py`

Add `score_job_for_profile(job: dict, profile: dict) -> dict`:

```python
# Returns:
{
  "score": 82,              # 0–100
  "summary": "Strong Python/FastAPI alignment...",
  "skill_matches": ["Python", "FastAPI", "PostgreSQL"],
  "skill_gaps": ["Kubernetes", "Go"],
  "seniority_fit": "good",  # "strong" | "good" | "stretch" | "poor"
}
```

Prompt should use:
- `profile.skills`, `profile.experience`, `profile.target_roles`
- `job.title`, `job.description`, `job.required_skills`
- Existing provider/model config (Gemini/Claude/OpenAI — whatever the user has configured)

### 3.2 Scoring Pipeline
Scoring is applied **after** dedup, **before** storing to `discovered_jobs`.

When `ai_scoring = true` on a search:
1. For each new job (not already scored), call `score_job_for_profile()`
2. Store `ai_match_score` and `ai_match_summary` on the `discovered_jobs` record
3. Already-seen jobs that get re-discovered keep their existing score (don't re-score)

> **Cost awareness:** Each job scored = 1 AI API call. With 25 results/search and 3 daily auto-checks, that's ~75 calls/day if all are new. In practice, after the first run most results are cached. Scoring only runs on new jobs.

### 3.3 Global Default + Onboarding
**File:** `frontend/src/pages/Settings.jsx` — Job Discovery section:
- "AI scoring on by default for new searches" toggle
- Persisted to `ui_config.job_discovery.ai_scoring_default`

**Onboarding:** If this is a new user with no saved searches yet, show a one-time prompt card on the Discover page:
> "Want AI to score how well each job matches your profile? You can turn this on per search or set a default in Settings."

---

## Phase 4: MCP & Advanced Providers
**Goal:** Expand coverage and optionally enable Claude-native job search.

### 4.1 JobSpy MCP Integration
- Install `jobspy-mcp-server` (open-source, `borgius/jobspy-mcp-server`)
- Surfaces LinkedIn, Indeed, Glassdoor, ZipRecruiter, Google Jobs — all in one MCP call
- Option A: Run as a sidecar process in Docker compose and call via HTTP
- Option B: Integrate `python-jobspy` directly as a Python provider in `JobSearchService`
  - `pip install python-jobspy` — returns a Pandas DataFrame
  - Wrap as `JobSpyProvider` in the same interface as other providers
  - **Recommended for Phase 4** — simpler than running a separate MCP process

### 4.2 Additional Providers
| Provider | Add When | Why |
|----------|----------|-----|
| `USAJobsProvider` | Phase 4 | Government jobs niche. Free, no auth fee. Richest filter API. |
| `JoobleProvider` | Phase 4 | 70+ countries — unlocks international expansion |
| `CareerJetProvider` | Phase 4 | 90+ countries, 28 languages |

### 4.3 Paid Service Account Integration
Replace the dev-`.env`-only key approach with a full account connection UI in Settings → Job Discovery → "Connected Sources":

**Per-provider connection card:**
```
┌──────────────────────────────────────────────┐
│  Adzuna                            [Connected]│
│  Free tier: 250/day · 2,500/month            │
│  Used today: 187/250  ██████████░░ 75%        │
│  Resets: in 3h 22m                           │
│  [Manage Key]  [Upgrade to Paid →]           │
└──────────────────────────────────────────────┘
```

Each card shows:
- Auth method: API key input (Adzuna, JSearch, The Muse, USAJobs) or OAuth flow (future — any provider that supports it)
- Current tier limits and live usage pulled from `provider_rate_limit_log`
- A "what you get on paid" summary (pulled from a static `PROVIDER_TIERS` config in the service) so users understand the upgrade path
- External link to the provider's pricing/signup page

**Auth methods by provider:**

| Provider | Free Auth | Paid Auth |
|----------|-----------|-----------|
| Adzuna | API key pair (app_id + app_key) | Same keys, higher tier |
| JSearch | RapidAPI key | Same key, paid RapidAPI plan |
| The Muse | Optional API key | Same key |
| USAJobs | API key + email header | Same (no paid tier) |
| SerpApi (future) | API key | Same key, paid plan |
| JobSpy / python-jobspy | None (scraping) | N/A |

All keys stored encrypted in user `Config` JSON (`ui_config.job_discovery.api_keys`). Never logged or exposed in API responses.

> **OAuth note:** No current providers require OAuth for job search access — it's all API keys for now. Design the connection card component to accept an `auth_type` prop (`"api_key"` | `"oauth"`) so OAuth providers can slot in without a component rewrite later.

---

## File Change Summary

### New Files
| File | Description |
|------|-------------|
| `backend/services/job_search_service.py` | Service + provider adapters (Adzuna, JSearch, The Muse, RemoteOK) + rate limit enforcement |
| `backend/routes/job_search.py` | REST endpoints for search, saved searches, discovered jobs, provider status |
| `frontend/src/pages/Discover.jsx` | Main job discovery page with provider status bar |
| `frontend/src/pages/Discover.css` | Styles for job cards, provider chips, saved search sidebar |

### Modified Files
| File | Change |
|------|--------|
| `backend/services/database_service.py` | Add 4 new tables (`saved_searches`, `discovered_jobs`, `search_run_log`, `provider_rate_limit_log`) + CRUD methods |
| `backend/services/ai_service.py` | Add `score_job_for_profile()` method |
| `backend/main.py` | Register `/routes/job_search` router; extend scheduler for daily sweep; add `link_screen="discover"` handling |
| `frontend/src/App.jsx` | Add `/discover` route; extend notification click-through |
| `frontend/src/components/Layout/Sidebar.jsx` | Add "Discover" nav item |
| `frontend/src/pages/Settings.jsx` | Add Job Discovery settings section (auto-sweep, AI default, API keys) |

---

## Phase Summary

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **Phase 1** | Manual job search, saved searches CRUD, Discover page, 4 provider adapters, Process Now / Save / Dismiss | ✅ Complete |
| **Phase 2** | Daily auto-sweep, notifications, notification click-through, Settings toggles | ⬜ Next |
| **Phase 3** | AI scoring per job, global default, onboarding prompt | ⬜ Pending |
| **Phase 4** | JobSpy/python-jobspy, USAJobs, international providers, API key management UI | ⬜ Pending |

## Next Steps (Phase 2)

Before starting Phase 2, a UI/UX design pass on the Discover page is planned. The functional foundation is solid; the visual design, information density, and detail panel layout need polish before Phase 2 is implemented on top of it.
