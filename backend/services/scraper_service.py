import re
import requests
from bs4 import BeautifulSoup
from typing import Optional
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse


class ScraperService:
    """Service for scraping job descriptions from URLs."""
    
    def _clean_url(self, url: str) -> str:
        """
        Clean job URLs — strip tracking parameters that mobile apps add.
        LinkedIn app shares URLs like:
          https://www.linkedin.com/comm/jobs/view/12345?trackingId=...&refId=...&midToken=...
        We normalize to: https://www.linkedin.com/jobs/view/12345
        """
        parsed = urlparse(url)
        
        # LinkedIn: normalize /comm/jobs/view/ → /jobs/view/
        if 'linkedin.com' in parsed.netloc:
            path = parsed.path.replace('/comm/jobs/', '/jobs/')
            # Strip all query params (they're all tracking for job view pages)
            return urlunparse((parsed.scheme, parsed.netloc.replace('www.', '').replace('linkedin.com', 'www.linkedin.com'), path, '', '', ''))
        
        return url

    def _extract_linkedin_from_html(self, html: str) -> Optional[str]:
        """
        Extract job-relevant content from LinkedIn's public job page HTML.
        LinkedIn's public pages have structured data we can parse directly.
        """
        soup = BeautifulSoup(html, 'html.parser')
        parts = []

        # 1. Page title often has "Company hiring Title in Location"
        title_tag = soup.find('title')
        if title_tag:
            parts.append(f"Page Title: {title_tag.get_text(strip=True)}")

        # 2. Open Graph / meta tags — LinkedIn always sets these
        for meta_name in ['og:title', 'og:description', 'twitter:title', 'twitter:description']:
            tag = soup.find('meta', attrs={'property': meta_name}) or soup.find('meta', attrs={'name': meta_name})
            if tag and tag.get('content'):
                parts.append(f"{meta_name}: {tag['content']}")

        # 3. Try actual job description content selectors
        desc_selectors = [
            {'class': 'description__text'},
            {'class': 'show-more-less-html__markup'},
            {'class': 'decorated-job-posting__details'},
        ]
        for sel in desc_selectors:
            el = soup.find(class_=sel['class'])
            if el:
                text = el.get_text(separator='\n', strip=True)
                if len(text) > 50:
                    parts.append(f"Job Description:\n{text}")
                    break

        # 4. Structured data (JSON-LD) — richest source if present
        for script_tag in soup.find_all('script', type='application/ld+json'):
            try:
                import json
                data = json.loads(script_tag.string)
                if isinstance(data, dict) and data.get('@type') == 'JobPosting':
                    parts.append(f"Structured Data: {json.dumps(data)}")
            except:
                pass

        # 5. Top-card info (public page structure)
        top_card = soup.find(class_='top-card-layout__entity-info') or soup.find(class_='topcard__content-left')
        if top_card:
            parts.append(f"Top Card: {top_card.get_text(separator=' | ', strip=True)}")

        if parts:
            return '\n\n'.join(parts)
        return None

    def _filter_jina_content(self, content: str) -> str:
        """
        Filter Jina Reader output to remove LinkedIn UI noise and keep job-relevant content.
        """
        lines = content.split('\n')
        filtered = []
        skip_patterns = [
            'Sign in', 'Join now', 'Continue with Google', 'Clear text',
            'Forgot password', 'User Agreement', 'Privacy Policy', 'Cookie Policy',
            'LinkedIn and 3rd parties', 'Expand search', 'search inputs',
            'Skip to main content', 'Join or sign in', 'New to LinkedIn',
            'By clicking Continue', 'selected search type',
        ]
        
        for line in lines:
            line_stripped = line.strip()
            # Skip empty lines and very short lines
            if not line_stripped:
                filtered.append('')
                continue
            # Skip LinkedIn UI elements
            if any(pattern in line_stripped for pattern in skip_patterns):
                continue
            # Skip image markdown links to LinkedIn assets
            if line_stripped.startswith('![') and ('licdn.com' in line_stripped or 'static.licdn' in line_stripped):
                continue
            # Skip bare navigation items
            if line_stripped in ['Jobs', 'People', 'Learning', 'Apply', 'Show', 'Email or phone', 'Password']:
                continue
            filtered.append(line)
        
        # Join and collapse multiple blank lines
        result = '\n'.join(filtered)
        result = re.sub(r'\n{3,}', '\n\n', result)
        return result.strip()

    # ── ATS platform detection patterns ────────────────────────────────────────
    ATS_PATTERNS = {
        'greenhouse':      [r'boards\.greenhouse\.io', r'grnh\.se'],
        'lever':           [r'jobs\.lever\.co', r'lever\.co'],
        'workday':         [r'myworkday\.com', r'workday\.com', r'wd\d+\.myworkdayjobs'],
        'successfactors':  [r'successfactors\.com', r'career\d*\.successfactors'],
        'icims':           [r'icims\.com', r'\.icims\.'],
        'smartrecruiters': [r'smartrecruiters\.com', r'jobs\.smartrecruiters'],
        'jobvite':         [r'jobvite\.com', r'jobs\.jobvite'],
        'ashby':           [r'ashbyhq\.com', r'jobs\.ashby'],
        'workable':        [r'apply\.workable\.com', r'workable\.com/'],
    }

    def _detect_ats(self, html: str, url: str) -> Optional[str]:
        """Detect which ATS platform a careers page uses."""
        combined = html + ' ' + url
        for platform, patterns in self.ATS_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, combined, re.IGNORECASE):
                    return platform
        return None

    def _extract_greenhouse_jobs(self, html: str, url: str) -> Optional[str]:
        """Try Greenhouse board API for job listings."""
        # Greenhouse boards look like: boards.greenhouse.io/{company}
        match = re.search(r'boards\.greenhouse\.io/([^/"\'\s?]+)', html + ' ' + url)
        if not match:
            return None
        company = match.group(1)
        try:
            api_url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
            resp = requests.get(api_url, timeout=10)
            if resp.ok:
                data = resp.json()
                jobs = data.get('jobs', [])
                if jobs:
                    lines = []
                    for j in jobs:
                        title = j.get('title', 'Unknown')
                        loc = j.get('location', {}).get('name', '')
                        link = j.get('absolute_url', '')
                        lines.append(f"• {title} — {loc}\n  Apply: {link}")
                    return f"Found {len(jobs)} open positions:\n\n" + "\n\n".join(lines)
        except Exception:
            pass
        return None

    def _extract_lever_jobs(self, html: str, url: str) -> Optional[str]:
        """Try Lever postings API for job listings."""
        match = re.search(r'jobs\.lever\.co/([^/"\'\s?]+)', html + ' ' + url)
        if not match:
            return None
        company = match.group(1)
        try:
            api_url = f"https://api.lever.co/v0/postings/{company}"
            resp = requests.get(api_url, timeout=10)
            if resp.ok:
                jobs = resp.json()
                if jobs:
                    lines = []
                    for j in jobs:
                        title = j.get('text', 'Unknown')
                        loc = j.get('categories', {}).get('location', '')
                        team = j.get('categories', {}).get('team', '')
                        link = j.get('hostedUrl', '')
                        lines.append(f"• {title} — {loc} ({team})\n  Apply: {link}")
                    return f"Found {len(jobs)} open positions:\n\n" + "\n\n".join(lines)
        except Exception:
            pass
        return None

    def _extract_ashby_jobs(self, html: str, url: str) -> Optional[str]:
        """Try Ashby API for job listings."""
        match = re.search(r'jobs\.ashbyhq\.com/([^/"\'\s?]+)', html + ' ' + url)
        if not match:
            return None
        company = match.group(1)
        try:
            api_url = f"https://api.ashbyhq.com/posting-api/job-board/{company}"
            resp = requests.get(api_url, timeout=10)
            if resp.ok:
                data = resp.json()
                jobs = data.get('jobs', [])
                if jobs:
                    lines = []
                    for j in jobs:
                        title = j.get('title', 'Unknown')
                        loc = j.get('location', '')
                        link = j.get('jobUrl', '')
                        lines.append(f"• {title} — {loc}\n  Apply: {link}")
                    return f"Found {len(jobs)} open positions:\n\n" + "\n\n".join(lines)
        except Exception:
            pass
        return None

    def _extract_workday_jobs(self, html: str, url: str, job_title: str = "") -> Optional[str]:
        """Try Workday's internal JSON API for job listings via POST."""
        # Match patterns like: company.wd5.myworkdayjobs.com or company.myworkdayjobs.com
        match = re.search(r'([\w-]+)\.(wd\d+\.)?myworkdayjobs\.com(?:/[^/]*/([^/\s"\'?]+))?', html + ' ' + url)
        if not match:
            return None
        company = match.group(1)
        wd_instance = match.group(2) or 'wd5.'
        # Try to extract the site name (e.g., "External", "en-US") from the URL path
        site_name = match.group(3) or 'External'
        
        try:
            api_url = f"https://{company}.{wd_instance}myworkdayjobs.com/wday/cxs/{company}/{site_name}/jobs"
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            # Try blank search first, then with job title
            for search_text in ["", job_title]:
                payload = {"limit": 20, "offset": 0, "searchText": search_text}
                resp = requests.post(api_url, json=payload, headers=headers, timeout=15)
                if resp.ok:
                    data = resp.json()
                    jobs = data.get('jobPostings', [])
                    total = data.get('total', len(jobs))
                    if jobs:
                        lines = []
                        for j in jobs:
                            title = j.get('title', 'Unknown')
                            loc_parts = []
                            for loc_key in ['locationsText', 'bulletFields']:
                                v = j.get(loc_key)
                                if v:
                                    loc_parts.append(str(v) if isinstance(v, str) else ', '.join(v))
                            loc = ' | '.join(loc_parts) if loc_parts else ''
                            ext_path = j.get('externalPath', '')
                            link = f"https://{company}.{wd_instance}myworkdayjobs.com{ext_path}" if ext_path else ''
                            lines.append(f"• {title} — {loc}\n  Apply: {link}")
                        return f"Found {total} open positions (showing {len(jobs)}):\n\n" + "\n\n".join(lines)
        except Exception:
            pass
        return None

    def _extract_smartrecruiters_jobs(self, html: str, url: str) -> Optional[str]:
        """Try SmartRecruiters public Posting API for job listings."""
        # Match: careers.smartrecruiters.com/CompanyName or jobs.smartrecruiters.com/CompanyName
        match = re.search(r'(?:careers|jobs)\.smartrecruiters\.com/([^/\s"\'?]+)', html + ' ' + url)
        if not match:
            return None
        company = match.group(1)
        try:
            api_url = f"https://api.smartrecruiters.com/v1/companies/{company}/postings"
            resp = requests.get(api_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
            if resp.ok:
                data = resp.json()
                jobs = data.get('content', [])
                if jobs:
                    lines = []
                    for j in jobs:
                        title = j.get('name', 'Unknown')
                        loc = j.get('location', {})
                        loc_str = f"{loc.get('city', '')} {loc.get('region', '')} {loc.get('country', '')}".strip()
                        dept = j.get('department', {}).get('label', '')
                        link = j.get('ref', j.get('applyUrl', ''))
                        lines.append(f"• {title} — {loc_str} ({dept})\n  Apply: {link}")
                    return f"Found {len(jobs)} open positions:\n\n" + "\n\n".join(lines)
        except Exception:
            pass
        return None

    def _extract_workable_jobs(self, html: str, url: str) -> Optional[str]:
        """Try Workable's public widget API for job listings."""
        match = re.search(r'apply\.workable\.com/(?:api/v\d+/widget/accounts/)?([^/\s"\'?]+)', html + ' ' + url)
        if not match:
            return None
        company = match.group(1)
        try:
            api_url = f"https://apply.workable.com/api/v1/widget/accounts/{company}"
            resp = requests.get(api_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
            if resp.ok:
                data = resp.json()
                jobs = data.get('jobs', [])
                if jobs:
                    lines = []
                    for j in jobs:
                        title = j.get('title', 'Unknown')
                        loc = j.get('location', '')
                        link = j.get('url', '')
                        dept = j.get('department', '')
                        lines.append(f"• {title} — {loc} ({dept})\n  Apply: {link}")
                    return f"Found {len(jobs)} open positions:\n\n" + "\n\n".join(lines)
        except Exception:
            pass
        return None

    def _extract_sitemap_jobs(self, url: str) -> Optional[str]:
        """Try to find and parse a sitemap.xml or RSS feed for job listings."""
        from urllib.parse import urlparse
        domain = urlparse(url).netloc
        scheme = urlparse(url).scheme
        base_url = f"{scheme}://{domain}"
        
        sitemap_urls = [
            f"{base_url}/sitemap.xml",
            f"{base_url}/sitemap_index.xml",
            f"{base_url}/jobs/sitemap.xml",
            url.rstrip('/') + "/sitemap.xml"
        ]
        
        for sitemap_url in set(sitemap_urls):
            try:
                resp = requests.get(sitemap_url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
                if not resp.ok:
                    continue
                    
                text = resp.text
                
                # Check for RSS feed format (used by SuccessFactors)
                items = re.findall(r'<item>(.*?)</item>', text, re.DOTALL | re.IGNORECASE)
                if items:
                    lines = []
                    for item in items:
                        title_match = re.search(r'<title>(.*?)</title>', item, re.IGNORECASE)
                        link_match = re.search(r'<link>(.*?)</link>', item, re.IGNORECASE)
                        if title_match and link_match:
                            title = title_match.group(1).replace('<![CDATA[', '').replace(']]>', '').strip()
                            link = link_match.group(1).replace('<![CDATA[', '').replace(']]>', '').strip()
                            # Only include if it looks like a job
                            if any(k in title.lower() or k in link.lower() for k in ['job', 'engineer', 'manager', 'specialist', 'analyst', 'director', 'requisition', 'technician']):
                                lines.append(f"• {title}\n  Apply: {link}")
                    
                    if lines:
                        return f"Found {len(lines)} jobs in RSS sitemap:\n\n" + "\n\n".join(lines)
                
                # Check for standard XML sitemap format
                urls = re.findall(r'<loc>(.*?)</loc>', text, re.IGNORECASE)
                if urls:
                    job_urls = [u for u in urls if any(k in u.lower() for k in ['/job/', 'jobreq', 'requisition', 'position', 'posting', 'careers'])]
                    if job_urls:
                        # Extract the final path segment as a pseudo-title
                        lines = []
                        for u in job_urls:
                            pseudo_title = u.strip('/').split('/')[-1].replace('-', ' ').title()
                            lines.append(f"• {pseudo_title}\n  Apply: {u}")
                        return f"Found {len(lines)} job URLs in XML sitemap:\n\n" + "\n\n".join(lines)
            except Exception:
                pass
                
        return None

    def _try_google_cache(self, careers_url: str, job_title: str = "") -> Optional[str]:
        """Use Google search to find cached/indexed job listings from a careers site."""
        try:
            from urllib.parse import quote_plus
            domain = urlparse(careers_url).netloc
            query = f"site:{domain} jobs"
            if job_title:
                query += f" \"{job_title}\""
            
            jina_search_url = f"https://s.jina.ai/{quote_plus(query)}"
            resp = requests.get(jina_search_url, headers={
                'User-Agent': 'Mozilla/5.0',
                'X-Return-Format': 'text',
            }, timeout=15)
            
            if resp.ok and len(resp.text) > 200:
                return resp.text
        except Exception:
            pass
        return None

    async def scrape_careers_page(self, url: str, job_title: str = "") -> str:
        """
        Scrape job listings from a company careers page.
        Uses a multi-strategy approach to handle JS-rendered ATS platforms:
        1. Detect ATS platform and try its public API
        2. Try Jina with JS rendering wait headers
        3. Fallback to Google-indexed content via Jina Search
        4. Last resort: raw HTTP + BeautifulSoup
        """
        import logging
        logger = logging.getLogger('app')
        
        headers_browser = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        # Step 0: Fetch raw HTML for ATS detection
        raw_html = ""
        try:
            resp = requests.get(url, headers=headers_browser, timeout=10)
            resp.raise_for_status()
            raw_html = resp.text
        except Exception as e:
            logger.warning(f"Could not fetch raw HTML for ATS detection: {e}")

        # Step 1: Detect ATS platform and try its API
        ats = self._detect_ats(raw_html, url)
        if ats:
            logger.info(f"Detected ATS platform: {ats} for {url}")
            api_result = None
            if ats == 'greenhouse':
                api_result = self._extract_greenhouse_jobs(raw_html, url)
            elif ats == 'lever':
                api_result = self._extract_lever_jobs(raw_html, url)
            elif ats == 'ashby':
                api_result = self._extract_ashby_jobs(raw_html, url)
            
            if api_result and len(api_result) > 100:
                logger.info(f"ATS API returned {len(api_result)} chars of job data")
                return api_result

        # Step 2: Check for sitemaps or RSS feeds (extremely common and reliable for SEO)
        logger.info(f"Checking for sitemap/RSS feeds at {url}")
        sitemap_result = self._extract_sitemap_jobs(url)
        if sitemap_result and len(sitemap_result) > 100:
            logger.info(f"Sitemap parser returned {len(sitemap_result)} chars of job data")
            return sitemap_result

        # Step 3: Try Jina Reader with JS wait selectors for common job list patterns
        try:
            jina_url = f"https://r.jina.ai/{url}"
            jina_headers = {
                'User-Agent': 'Mozilla/5.0',
                'X-Return-Format': 'text',
                'X-Wait-For-Selector': '.job-listing, .job-title, .requisition, [class*="job"], [data-job], a[href*="job"], tr[class*="result"]',
                'X-Timeout': '15',
            }
            jina_resp = requests.get(jina_url, headers=jina_headers, timeout=20)
            jina_resp.raise_for_status()
            
            jina_text = jina_resp.text
            # Check if the Jina response actually contains job-like content
            job_indicators = ['apply', 'requisition', 'position', 'location', 'remote', 'hybrid', 'full-time', 'part-time']
            indicator_count = sum(1 for ind in job_indicators if ind in jina_text.lower())
            
            if len(jina_text) > 500 and indicator_count >= 3:
                logger.info(f"Jina JS rendering returned {len(jina_text)} chars with {indicator_count} job indicators")
                return jina_text
            else:
                logger.info(f"Jina returned {len(jina_text)} chars but only {indicator_count} job indicators — likely shell content")
        except Exception as e:
            logger.warning(f"Jina JS rendering failed for {url}: {e}")

        # Step 3: Try Google-indexed content via Jina Search
        google_result = self._try_google_cache(url, job_title)
        if google_result and len(google_result) > 200:
            logger.info(f"Google cache/search returned {len(google_result)} chars for {url}")
            return google_result

        # Step 4: Last resort — strip JS/CSS from raw HTML and return what we have
        if raw_html:
            logger.info(f"Falling back to raw HTML parsing for {url}")
            soup = BeautifulSoup(raw_html, 'html.parser')
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.extract()
            
            # Try to find any links that look like job listings
            job_links = []
            for a in soup.find_all('a', href=True):
                href = a['href']
                text = a.get_text(strip=True)
                if text and len(text) > 5 and any(k in href.lower() for k in ['job', 'position', 'career', 'requisition', 'opening', 'apply']):
                    job_links.append(f"• {text}\n  Link: {href}")
            
            page_text = soup.get_text(separator='\n', strip=True)
            if job_links:
                return f"Job-related links found on page:\n\n" + "\n\n".join(job_links[:50]) + f"\n\n---\nPage text:\n{page_text}"
            return page_text

        raise ValueError(f"All scraping strategies failed for {url}")

    async def scrape_url(self, url: str) -> str:
        """
        Scrape content from any URL using a robust approach.
        Primarily uses Jina Reader for high-quality text/markdown extraction.
        """
        try:
            # For general scraping, Jina is more reliable than manual BS4 for arbitrary sites
            jina_url = f"https://r.jina.ai/{url}"
            jina_headers = {
                'User-Agent': 'Mozilla/5.0',
                'X-Return-Format': 'text',
            }
            
            response = requests.get(jina_url, headers=jina_headers, timeout=15)
            response.raise_for_status()
            
            if response.text and len(response.text) > 50:
                return response.text
            else:
                raise ValueError("Jina API yielded too little or no text.")
                
        except Exception as e:
            # Fallback to standard request if Jina fails
            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
                resp = requests.get(url, headers=headers, timeout=10)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, 'html.parser')
                
                # Strip script and style elements
                for script in soup(["script", "style"]):
                    script.extract()
                    
                text = soup.get_text(separator='\n', strip=True)
                return text
            except Exception as e2:
                raise ValueError(f"Failed to scrape URL {url}: {e} (Fallback: {e2})")

    async def scrape_job_description(self, url: str) -> str:
        """
        Scrape job description from a URL.
        Attempts to extract the main job description text from common job sites with a Jina Reader fallback.
        """
        # Clean tracking params from mobile app URLs
        url = self._clean_url(url)
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # For LinkedIn, try specialized extraction first
            if 'linkedin.com' in url:
                linkedin_text = self._extract_linkedin_from_html(response.text)
                if linkedin_text and len(linkedin_text) > 100:
                    return linkedin_text
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Try common job description selectors
            selectors = [
                # LinkedIn
                {'class': 'description__text'},
                {'class': 'show-more-less-html__markup'},
                # Indeed
                {'id': 'jobDescriptionText'},
                {'class': 'jobsearch-jobDescriptionText'},
                # Generic
                {'class': 'job-description'},
                {'class': 'job_description'},
                {'id': 'job-description'},
                # Fallback to article or main content
                {'tag': 'article'},
                {'tag': 'main'},
            ]
            
            job_text = None
            
            for selector in selectors:
                if 'class' in selector:
                    element = soup.find(class_=selector['class'])
                elif 'id' in selector:
                    element = soup.find(id=selector['id'])
                elif 'tag' in selector:
                    element = soup.find(selector['tag'])
                else:
                    continue
                
                if element:
                    job_text = element.get_text(separator='\n', strip=True)
                    break
            
            # If still no job text found, try to get all paragraph text
            if not job_text:
                paragraphs = soup.find_all('p')
                job_text = '\n'.join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
            
            if not job_text:
                raise ValueError("Could not extract job description from URL")
            
            return job_text
            
        except Exception as standard_error:
            print(f"Standard scraping failed: {standard_error}. Falling back to Jina API.")
            try:
                # Fallback to r.jina.ai for robust scraping and markdown extraction
                jina_url = f"https://r.jina.ai/{url}"
                jina_headers = {
                    'User-Agent': 'Mozilla/5.0',
                    'X-Return-Format': 'text',
                }
                
                jina_response = requests.get(jina_url, headers=jina_headers, timeout=15)
                jina_response.raise_for_status()
                
                if jina_response.text and len(jina_response.text) > 50:
                    # Filter out LinkedIn UI noise from Jina output
                    if 'linkedin.com' in url:
                        filtered = self._filter_jina_content(jina_response.text)
                        if len(filtered) > 50:
                            return filtered
                    return jina_response.text
                else:
                    raise ValueError("Jina API yielded too little or no text.")
                
            except Exception as jina_error:
                raise ValueError(f"Failed to parse job description via standard and Jina fallback methods. (Standard: {standard_error}) (Jina: {jina_error})")
