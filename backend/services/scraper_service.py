import requests
from bs4 import BeautifulSoup
from typing import Optional


class ScraperService:
    """Service for scraping job descriptions from URLs."""
    
    async def scrape_job_description(self, url: str) -> str:
        """
        Scrape job description from a URL.
        Attempts to extract the main job description text from common job sites with a Jina Reader fallback.
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
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
                jina_headers = {'User-Agent': 'Mozilla/5.0'}
                
                jina_response = requests.get(jina_url, headers=jina_headers, timeout=15)
                jina_response.raise_for_status()
                
                if jina_response.text and len(jina_response.text) > 50:
                    return jina_response.text
                else:
                    raise ValueError("Jina API yielded too little or no text.")
                
            except Exception as jina_error:
                raise ValueError(f"Failed to parse job description via standard and Jina fallback methods. (Standard: {standard_error}) (Jina: {jina_error})")
