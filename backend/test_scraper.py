import asyncio
import os
import sys
import json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.document_service import DocumentService
from services.ai_service import AIService
from services.scraper_service import ScraperService

async def test():
    ds = DocumentService()
    ai = AIService()
    scraper = ScraperService()
    
    file_path = "Robert-Dannenbring-Resume-Base.docx"
    
    # Check if the file exists
    if not os.path.exists(file_path):
        print(f"Error: {file_path} does not exist.")
        return

    resume_data = ds.parse_docx(file_path)
    job_url = "https://jobs.boehringer-ingelheim.com/job/Ridgefield%2C-CT-Sr-Principal-Software-Engineer-Full-Stack-Unit/1367054333/"
    
    print(f"Scraping job URL: {job_url}")
    job_description = await scraper.scrape_job_description(job_url)
    print("Scraped length:", len(job_description or ""))
    print("Scraped text start:", (job_description or "")[:100])
    
    print("Tailoring resume...")
    try:
        tailored_resume_data = await ai.tailor_resume(resume_data, job_description)
        print("Success!")
    except Exception as e:
        print("Error tailoring:", e)

if __name__ == "__main__":
    asyncio.run(test())
