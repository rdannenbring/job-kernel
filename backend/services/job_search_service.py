import logging
import os
import re
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse, urlencode, urlunparse, parse_qs, urljoin

import httpx

logger = logging.getLogger("app")

ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "")
JSEARCH_KEY = os.getenv("JSEARCH_KEY", "")
THEMUSE_KEY = os.getenv("THEMUSE_KEY", "")


@dataclass
class SearchParams:
    keywords: str
    location: str = ""
    remote_filter: str = "any"  # "any"|"remote"|"local"|"hybrid"
    max_results: int = 25


@dataclass
class JobListing:
    external_id: str
    source_provider: str
    url: str
    title: str
    company: str
    location: str
    remote_type: str  # "remote"|"hybrid"|"onsite"|"unknown"
    salary_min: Optional[float]
    salary_max: Optional[float]
    salary_currency: Optional[str]
    description: str
    raw_data: dict


def _detect_remote_type_from_text(title: str, description: str) -> str:
    combined = (title + " " + description).lower()
    if "hybrid" in combined:
        return "hybrid"
    if "remote" in combined:
        return "remote"
    return "onsite"


class AdzunaProvider:
    name = "adzuna"
    BASE_URL = "https://api.adzuna.com/v1/api/jobs/us/search/1"

    def is_available(self, rate_status: dict) -> bool:
        if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
            return False
        status = rate_status.get(self.name, {})
        for window_type, limit in self.get_windows():
            used = status.get(window_type, 0)
            if used >= limit:
                return False
        return True

    def get_windows(self) -> list:
        return [("day", 250), ("week", 1000), ("month", 2500)]

    def search(self, params: SearchParams) -> list:
        keywords = params.keywords
        if params.remote_filter == "remote":
            keywords = keywords + " remote"

        query_params = {
            "app_id": ADZUNA_APP_ID,
            "app_key": ADZUNA_APP_KEY,
            "what": keywords,
            "results_per_page": params.max_results,
            "content-type": "application/json",
        }
        if params.location:
            query_params["where"] = params.location

        try:
            response = httpx.get(self.BASE_URL, params=query_params, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.error(f"AdzunaProvider search error: {e}")
            return []

        results = []
        for item in data.get("results", []):
            contract_type = item.get("contract_type", "")
            title = item.get("title", "")
            description = item.get("description", "")

            if contract_type in ("permanent", "contract"):
                remote_type = _detect_remote_type_from_text(title, description)
            else:
                remote_type = _detect_remote_type_from_text(title, description)

            company_info = item.get("company", {})
            location_info = item.get("location", {})

            listing = JobListing(
                external_id=str(item.get("id", "")),
                source_provider=self.name,
                url=item.get("redirect_url", ""),
                title=title,
                company=company_info.get("display_name", "") if isinstance(company_info, dict) else "",
                location=location_info.get("display_name", "") if isinstance(location_info, dict) else "",
                remote_type=remote_type,
                salary_min=item.get("salary_min"),
                salary_max=item.get("salary_max"),
                salary_currency=item.get("currency"),
                description=description,
                raw_data=item,
            )
            results.append(listing)

        return results


class JSearchProvider:
    name = "jsearch"
    BASE_URL = "https://api.openwebninja.com/jsearch/search-v2"

    def is_available(self, rate_status: dict) -> bool:
        if not JSEARCH_KEY:
            return False
        status = rate_status.get(self.name, {})
        for window_type, limit in self.get_windows():
            used = status.get(window_type, 0)
            if used >= limit:
                return False
        return True

    def get_windows(self) -> list:
        return [("month", 1000)]

    def search(self, params: SearchParams) -> list:
        query = params.keywords
        if params.location:
            query = f"{query} {params.location}"

        query_params = {
            "query": query,
            "num_pages": 1,
            "date_posted": "month",
        }
        if params.remote_filter == "remote":
            query_params["remote_jobs_only"] = "true"
        else:
            query_params["remote_jobs_only"] = "false"

        headers = {
            "X-API-Key": JSEARCH_KEY,
        }

        try:
            response = httpx.get(self.BASE_URL, params=query_params, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.error(f"JSearchProvider search error: {e}")
            return []

        results = []
        for item in data.get("data", {}).get("jobs", []):
            is_remote = item.get("job_is_remote", False)
            remote_type = "remote" if is_remote else "onsite"

            city = item.get("job_city", "") or ""
            country = item.get("job_country", "") or ""
            location_parts = [p for p in [city, country] if p]
            location = ", ".join(location_parts)

            salary_min = item.get("job_min_salary")
            salary_max = item.get("job_max_salary")

            listing = JobListing(
                external_id=item.get("job_id", ""),
                source_provider=self.name,
                url=item.get("job_apply_link", ""),
                title=item.get("job_title", ""),
                company=item.get("employer_name", ""),
                location=location,
                remote_type=remote_type,
                salary_min=float(salary_min) if salary_min is not None else None,
                salary_max=float(salary_max) if salary_max is not None else None,
                salary_currency=item.get("job_salary_currency"),
                description=item.get("job_description", ""),
                raw_data=item,
            )
            results.append(listing)

        return results


class TheMuseProvider:
    name = "themuse"
    BASE_URL = "https://www.themuse.com/api/public/jobs"

    def is_available(self, rate_status: dict) -> bool:
        status = rate_status.get(self.name, {})
        for window_type, limit in self.get_windows():
            used = status.get(window_type, 0)
            if used >= limit:
                return False
        return True

    def get_windows(self) -> list:
        return [("hour", 3600)]

    def search(self, params: SearchParams) -> list:
        query_params = {
            "page": 0,
            "descending": "true",
        }
        if THEMUSE_KEY:
            query_params["api_key"] = THEMUSE_KEY

        try:
            response = httpx.get(self.BASE_URL, params=query_params, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.error(f"TheMuseProvider search error: {e}")
            return []

        keywords_lower = [kw.strip().lower() for kw in params.keywords.split() if kw.strip()]

        results = []
        for item in data.get("results", []):
            title = item.get("name", "")
            if keywords_lower:
                title_lower = title.lower()
                if not any(kw in title_lower for kw in keywords_lower):
                    continue

            locations = item.get("locations", [])
            location_name = locations[0].get("name", "") if locations else ""
            remote_type = "remote" if "remote" in location_name.lower() else "onsite"

            refs = item.get("refs", {})
            url = refs.get("landing_page", "") if isinstance(refs, dict) else ""

            levels = item.get("levels", [])
            level_name = levels[0].get("short_name", "") if levels else ""

            listing = JobListing(
                external_id=str(item.get("id", "")),
                source_provider=self.name,
                url=url,
                title=title,
                company=item.get("company", {}).get("name", "") if isinstance(item.get("company"), dict) else "",
                location=location_name,
                remote_type=remote_type,
                salary_min=None,
                salary_max=None,
                salary_currency=None,
                description=item.get("contents", ""),
                raw_data=item,
            )
            results.append(listing)

        return results


class RemoteOKProvider:
    name = "remoteok"
    BASE_URL = "https://remoteok.com/api"

    def is_available(self, rate_status: dict) -> bool:
        return True

    def get_windows(self) -> list:
        return []

    def search(self, params: SearchParams) -> list:
        if params.remote_filter not in ("any", "remote"):
            return []

        headers = {"User-Agent": "JobKernel/1.0"}

        try:
            response = httpx.get(self.BASE_URL, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.error(f"RemoteOKProvider search error: {e}")
            return []

        keywords_lower = [kw.strip().lower() for kw in params.keywords.split() if kw.strip()]

        results = []
        for item in data[1:]:  # skip first metadata item
            if not isinstance(item, dict):
                continue

            position = item.get("position", "")
            description = item.get("description", "")

            if keywords_lower:
                combined = (position + " " + description).lower()
                if not any(kw in combined for kw in keywords_lower):
                    continue

            salary_min = item.get("salary_min")
            salary_max = item.get("salary_max")

            listing = JobListing(
                external_id=str(item.get("id", "")),
                source_provider=self.name,
                url=item.get("url", ""),
                title=position,
                company=item.get("company", ""),
                location="Remote",
                remote_type="remote",
                salary_min=float(salary_min) if salary_min is not None else None,
                salary_max=float(salary_max) if salary_max is not None else None,
                salary_currency="USD",
                description=description,
                raw_data=item,
            )
            results.append(listing)

        return results


_TRACKING_PARAMS = re.compile(
    r"^(utm_\w+|ref|source|campaign|medium|term|content|gclid|fbclid|msclkid)$",
    re.IGNORECASE,
)


class JobSearchService:
    def __init__(self, database_service=None):
        self.providers = [
            AdzunaProvider(),
            JSearchProvider(),
            TheMuseProvider(),
            RemoteOKProvider(),
        ]
        self.db = database_service

    def get_provider_config(self) -> dict:
        """Return which providers have their required API keys configured."""
        return {
            'adzuna':   {'configured': bool(os.getenv('ADZUNA_APP_ID') and os.getenv('ADZUNA_APP_KEY'))},
            'jsearch':  {'configured': bool(os.getenv('JSEARCH_KEY'))},
            'themuse':  {'configured': True},   # key optional — works without one
            'remoteok': {'configured': True},   # no key required
        }

    def search(self, params: SearchParams, user_id: int = None, provider_names: list = None) -> dict:
        rate_status = {}
        if self.db is not None:
            try:
                rate_status = self.db.get_provider_rate_status(user_id or 0) or {}
            except Exception as e:
                logger.error(f"JobSearchService: failed to get rate status: {e}")

        all_listings = []

        for provider in self.providers:
            if provider_names is not None and provider.name not in provider_names:
                continue

            if not provider.is_available(rate_status):
                logger.info(f"JobSearchService: provider {provider.name} is unavailable (rate limit or missing key)")
                continue

            try:
                listings = provider.search(params)
            except Exception as e:
                logger.error(f"JobSearchService: provider {provider.name} raised an error: {e}")
                listings = []

            if listings:
                all_listings.extend(listings)
                if self.db is not None:
                    for window_type, limit in provider.get_windows():
                        try:
                            self.db.increment_provider_usage(user_id or 0, provider.name, window_type, limit)
                        except Exception as e:
                            logger.error(
                                f"JobSearchService: failed to increment usage for {provider.name}/{window_type}: {e}"
                            )

        deduplicated = self._deduplicate(all_listings)

        return {
            "jobs": [asdict(listing) for listing in deduplicated],
            "provider_status": rate_status,
        }

    def _normalize_url(self, url: str) -> str:
        if not url:
            return url
        try:
            parsed = urlparse(url)
            scheme = parsed.scheme.lower()
            netloc = parsed.netloc.lower()
            path = parsed.path

            query_pairs = parse_qs(parsed.query, keep_blank_values=True)
            filtered_pairs = {
                k: v for k, v in query_pairs.items() if not _TRACKING_PARAMS.match(k)
            }

            new_query = urlencode(filtered_pairs, doseq=True)
            normalized = urlunparse((scheme, netloc, path, parsed.params, new_query, ""))
            return normalized
        except Exception:
            return url.lower()

    def _deduplicate(self, listings: list) -> list:
        seen_urls = set()
        result = []
        for listing in listings:
            norm = self._normalize_url(listing.url)
            if norm and norm in seen_urls:
                continue
            if norm:
                seen_urls.add(norm)
            result.append(listing)
        return result
