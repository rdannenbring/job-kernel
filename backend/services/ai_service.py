import os
from openai import OpenAI
from typing import Dict, Any
import json

class AIService:
    """Service for AI-powered resume tailoring using OpenAI."""
    
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("⚠️  WARNING: OPENAI_API_KEY not set. AI features will not work.")
            self.client = None
        else:
            self.client = OpenAI(api_key=api_key)
    
    async def analyze_job_description(self, job_description: str) -> Dict[str, Any]:
        """
        Analyze a job description to extract key requirements, skills, and keywords.
        """
        if not self.client:
            return {
                "error": "OpenAI API key not configured",
                "skills": [],
                "keywords": [],
                "requirements": []
            }
        
        prompt = f"""
        Analyze the following job description and extract:
        1. Required skills (technical and soft skills)
        2. Key responsibilities
        3. Required qualifications
        4. Important keywords and phrases
        5. Company culture indicators
        
        Job Description:
        {job_description}
        
        Return the analysis in JSON format with keys: skills, responsibilities, qualifications, keywords, culture.
        """
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert resume and job description analyst. Extract key information in JSON format."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            analysis = json.loads(response.choices[0].message.content)
            return analysis
            
        except Exception as e:
            print(f"Error analyzing job description: {e}")
            return {
                "error": str(e),
                "skills": [],
                "keywords": [],
                "requirements": []
            }
    
    async def tailor_resume(self, resume_data: Dict[str, Any], job_description: str) -> Dict[str, Any]:
        """
        Tailor a resume based on job description while maintaining formatting.
        """
        if not self.client:
            # Return original resume if no AI available
            return resume_data
        
        # First, analyze the job
        job_analysis = await self.analyze_job_description(job_description)
        
        prompt = f"""
        You are an expert resume writer. Tailor the following resume to match the job description.
        
        ORIGINAL RESUME:
        {json.dumps(resume_data, indent=2)}
        
        JOB DESCRIPTION:
        {job_description}
        
        JOB ANALYSIS:
        {json.dumps(job_analysis, indent=2)}
        
        CRITICAL INSTRUCTIONS - MUST FOLLOW EXACTLY:
        1. **MAINTAIN EXACT STRUCTURE**: Return the SAME number of sections as the input
        2. **MAINTAIN EXACT ITEM COUNT**: Each section must have the SAME number of content items as the original
        3. **PRESERVE SECTION TITLES**: Keep section titles identical (e.g., "EXPERIENCE", "EDUCATION", "SKILLS")
        4. **PRESERVE CONTACT INFO**: The first 4-5 items in 'full_text' are contact information (name, email, LinkedIn, address, etc.) - DO NOT MODIFY THESE AT ALL. Keep them exactly as they are.
        5. **MODIFY CONTENT ONLY**: Only change the text content of professional experience/skills items, not the structure or contact info
        6. Keep all dates, company names, and job titles unchanged
        7. Emphasize relevant experience by rewording bullet points to highlight matching skills
        8. Add relevant keywords from the job description naturally into existing bullet points
        9. Do NOT add new bullet points or sections
        10. Do NOT remove bullet points or sections
        11. Do NOT fabricate experience or skills
        
        STRUCTURE REQUIREMENT:
        - If the original has 3 sections with [2, 5, 3] items respectively, return 3 sections with [2, 5, 3] items
        - Each content item in the output should correspond 1-to-1 with an item in the input
        - CRITICAL: Preserve the 'full_text' array with EXACTLY the same number of items ({len(resume_data.get('full_text', []))})
        - The 'full_text' array contains the resume paragraphs in order - update the text but keep the same count
        - The first 4-5 items in 'full_text' are contact details - NEVER modify these
        
        Return the tailored resume in the EXACT SAME JSON structure as the input, with only the text content modified.
        Include a "summary" field with a brief explanation of changes made.
        """
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert resume writer who tailors resumes while maintaining authenticity and structure."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.5
            )
            
            tailored_resume = json.loads(response.choices[0].message.content)
            return tailored_resume
            
        except Exception as e:
            print(f"Error tailoring resume: {e}")
            # Return original resume with error note
            resume_data["summary"] = f"Error during tailoring: {str(e)}"
            return resume_data
