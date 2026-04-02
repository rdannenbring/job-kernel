import asyncio
import os
import sys
import json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.document_service import DocumentService
from services.ai_service import AIService

async def test():
    ds = DocumentService()
    ai = AIService()
    
    file_path = "Robert-Dannenbring-Resume-Base.docx"
    resume_data = ds.parse_docx(file_path)
    
    with open("config.json", "r") as f:
        config = json.load(f)
    job_url = config.get("default_job_url")
    from services.scraper_service import ScraperService
    job_description = await ScraperService().scrape_job_description(job_url)
    if not job_description:
        job_description = "We need a SENIOR CLOUD SOLUTIONS ARCHITECT with GCP experience."
        
    print("Calling AI...")
    tailored_resume_data = await ai.tailor_resume(resume_data, job_description)
    
    print("AI Title in full_text[4]:", tailored_resume_data.get("full_text", [])[4])
    print("AI Title in sections[0]['content'][0]:", tailored_resume_data.get("sections", [])[0].get("content", [])[0])
    
    print("Change summary:")
    for change in tailored_resume_data.get("change_summary", []):
         print("-", change)

if __name__ == "__main__":
    asyncio.run(test())
