import requests
from bs4 import BeautifulSoup
from typing import Optional


class ScraperService:
    """Service for scraping job descriptions from URLs."""
    
    async def scrape_job_description(self, url: str) -> str:
        """
        Scrape job description from a URL.
        Attempts to extract the main job description text from common job sites.
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
            
        except requests.exceptions.RequestException as e:
            raise ValueError(f"Failed to fetch URL: {str(e)}")
        except Exception as e:
            raise ValueError(f"Failed to parse job description: {str(e)}")
