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
