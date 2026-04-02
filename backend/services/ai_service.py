import os
from openai import OpenAI
import anthropic
import google.generativeai as genai
from typing import Dict, Any, List
import json
import logging
import re
from datetime import datetime

logger = logging.getLogger("uvicorn")

DEFAULT_PROMPTS = {
    "analyze_job": """Analyze the following job description and extract key information.

CURRENT DATE: {current_date}
        
Job Description:
{job_description}

Return a JSON object with this EXACT structure:
{{
    "skills": ["List", "of", "skills"],
    "responsibilities": ["List", "of", "items"],
    "keywords": ["List", "of", "keywords"],
    "culture": "String description",
    "metadata": {{
        "job_title": "Extract exact job title or 'Unknown Role'",
        "company": "Extract company name or 'Unknown Company'",
        "salary_range": "Extract salary range if present (e.g. '$160k-$190k' or '$50/hr'), else 'Not Listed'",
        "date_posted": "Extract date. If a relative date is found (e.g., '4 days ago', 'Posted yesterday'), calculate the ACTUAL date based on CURRENT DATE and return it as YYYY-MM-DD. Else 'Unknown'.",
        "deadline": "Extract application deadline if present (YYYY-MM-DD), else ''",
        "job_type": "Extract 'Full-time', 'Part-time', 'Contract', 'Freelance', or 'Internship'",
        "location_type": "Extract 'On-site', 'Remote', or 'Hybrid'",
        "location": "Extract city/state or 'Remote'",
        "relocation": true/false or null,
        "interest_level": "Extract 'High', 'Medium', or 'Low'",
        "glassdoor_rating": "Rating or null",
        "glassdoor_url": "URL or null",
        "indeed_rating": "Rating or null",
        "indeed_url": "URL or null",
        "linkedin_rating": "Rating or null",
        "linkedin_url": "URL or null"
    }}
}}""",
    "tailor_resume": """You are an expert resume writer. Tailor the following resume to match the job description.
        
ORIGINAL RESUME CONTENT (Header/Contact Info removed for protection):
{resume_data}

JOB DESCRIPTION:
{job_description}

JOB ANALYSIS:
{job_analysis}

{additional_context_instr}

CRITICAL INSTRUCTIONS - MUST FOLLOW EXACTLY:
1. **MAINTAIN EXACT STRUCTURE**: Return the SAME number of sections as the input
2. **MAINTAIN EXACT ITEM COUNT**: Each section must have the SAME number of content items as the original
3. **PRESERVE SECTION TITLES**: Keep section titles identical (e.g., "EXPERIENCE", "EDUCATION", "SKILLS")
4. **MODIFY CONTENT ONLY**: Only change the text content of professional experience/skills items, not the structure
5. **NEVER DROP HEADERS**: You MUST perfectly copy over the applicant's Name, Contact Info, and ALL section headers (like "EXECUTIVE SUMMARY", "EXPERIENCE"). Do not drop these from the `full_text` array under any circumstances.
6. You MUST update the main professional title at the top of the resume to better match the target job title.
6. Keep all dates, company names, and PAST job titles (in the experience section) exactly unchanged.
7. Emphasize relevant experience by rewording bullet points to highlight matching skills
7. Add relevant keywords from the job description naturally into existing bullet points
8. Do NOT add new bullet points or sections
9. Do NOT remove bullet points or sections
10. DO NOT fabricate experience or skills
11. **URL FORMATTING**: If any web addresses are included (e.g., in Projects or Summary), CLEAN them by removing "http://", "https://", and "www." prefixes (e.g., use "github.com/user" instead of "https://www.github.com/user").
12. **PRESERVE MARKDOWN FORMATTING**: You MUST keep all markdown syntax that was present in the original (e.g., **bold**, *italics*, bullet points, and # headers). Do not strip markdown formatting. If a section title had a markdown header (e.g., "### EXPERIENCE"), keep it exactly as "### EXPERIENCE". Keep all existing bullet points ("- ") exactly as they are formatted.

STRUCTURE REQUIREMENT:
- If the original has 3 sections with [2, 5, 3] items respectively, return 3 sections with [2, 5, 3] items
- Each content item in the output should correspond 1-to-1 with an item in the input
- CRITICAL: Preserve the 'full_text' array with EXACTLY the same number of items ({item_count})
- The 'full_text' array contains the resume paragraphs in order - update the text but keep the same count

Return the tailored resume in the EXACT SAME JSON structure as the input, with only the text content modified.

Additionally, include a "change_summary" field with a concise list of 3-5 bullet points explaining exactly what was updated (e.g., "Added keyword X to Skills", "Rewrote Professional Summary to focus on Y").""",
    "refine_resume": """You are a meticulous resume editor. Refine the following resume based on these instructions.

CURRENT RESUME DATA:
{resume_data}

{additional_context_instr}

REFINEMENT INSTRUCTIONS:
{instructions}

CRITICAL RULES:
1. **PRESERVE STRUCTURE**: Maintain the exact same JSON structure, section titles, and item counts.
2. **FOLLOW INSTRUCTIONS**: Apply the requested changes while keeping the tailoring for the target job in mind.
3. **USE ADDITIONAL CONTEXT**: If additional context is provided above, use it to support the requested refinements.
4. **NO MARKDOWN**: Output raw text only.
5. **URL CLEANING**: Continue cleaning web addresses by removing "http://", "https://", and "www.".

Return the updated resume in the same JSON structure.""",
    "extract_profile": """Extract structured data from the resume text below.
        
RESUME TEXT:
{resume_text}

Return a JSON object with this EXACT structure:
{{
    "contact_info": {{
        "first_name": "", "last_name": "", "full_name": "",
        "address_line1": "", "address_line2": "", "city": "", "state": "", "zip_code": "",
        "phone_primary": "", "phone_secondary": "", "email": "",
        "linkedin_url": "", "github_url": "", "website_url": "",
        "job_title": "", "bio": ""
    }},
    "skills": ["List", "of", "skill", "strings"],
    "experiences": [
        {{
            "company": "Company Name",
            "position": "Job Title",
            "start_date": "e.g. Jan 2020",
            "end_date": "e.g. Present",
            "description": "Brief summary of responsibilities"
        }}
    ],
    "educations": [
        {{
            "institution": "University Name",
            "degree": "e.g. BS Computer Science",
            "field_of_study": "Major/Field",
            "start_date": "Year",
            "end_date": "Year"
        }}
    ],
    "certificates": [
        {{
            "name": "Title of certificate",
            "issuer": "Issuing organization",
            "date": "Date issued",
            "url": "Link to certificate if present"
        }}
    ],
    "other": [
        {{
            "title": "Category (e.g. Languages, Projects, Volunteer)",
            "content": "Description or details"
        }}
    ]
}}""",
    "generate_cover_letter": """You are an expert career coach. Write a compelling, professional cover letter for the candidate based on their resume and the job description.
        
CURRENT DATE: {current_date}

CANDIDATE CONTACT INFO:
{profile_context}

RESUME CONTENT:
{resume_text}

JOB DESCRIPTION:
{job_description}

{additional_context_instr}

INSTRUCTIONS:
1. **DATE**: Use '{current_date}' as the date in the letter.
2. **TONE**: Professional, enthusiastic, and confident.
3. **HEADER / CONTACT INFO**:
   - Use the provided Candidate Contact Info at the top.
   - **PROFILE LINKS**: ONLY include LinkedIn or Portfolio links if they are explicitly provided in the contact info above. DO NOT create placeholders like "[LinkedIn Profile]" or "[Website]" if the data is missing.
   - **URL CLEANING**: For any URLs included, remove "http://", "https://", and "www." prefixes (e.g., use "linkedin.com/in/user" instead of "https://www.linkedin.com/in/user").
4. **RECIPIENT & COMPANY ADDRESS**:
   - **Recruiter**: If a specific name is in the job description, address them (e.g., "Dear Ms. Smith"). Otherwise, use "Dear Hiring Manager".
   - **Company Address**: 
     a) Look for the address in the job description.
     b) If not found, use your internal knowledge to find the company's Headquarters address.
     c) **CRITICAL**: If you absolutely cannot find the address, **OMIT THE ADDRESS BLOCK ENTIRELY**.
     d) **ALWAYS** include the Company Name if known.
5. **CONTENT**: Highlight specific achievements from the resume that align with the required skills. Use details from the additional context documents if provided to add more depth and personalization to the letter. Keep it to 3-4 paragraphs.

Return the result as a JSON object with:
   - "content": The full text of the letter.
   - "generation_summary": A list of 3-5 concise bullet points explaining your strategy.
   - "detected_info": {{
        "recruiter_name": "Name or 'Unknown'",
        "company_address": "Address or 'Unknown'",
        "company_name": "Extracted Company Name"
     }}""",
    "refine_cover_letter": """Refine the following cover letter based on the user's instructions.
        
CURRENT CONTENT:
{current_content}

{additional_context_instr}

INSTRUCTIONS:
"{instructions}"

Return the updated text in a JSON object with a "content" field.""",
    "score_job_match": """You are an expert technical recruiter and career coach. Assess the compatibility between the candidate's profile/resume and the job description.

CURRENT DATE: {current_date}

CANDIDATE PROFILE / RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

{additional_context_instr}

INSTRUCTIONS:
Evaluate the match based on the following 5 criteria. For each, provide a score out of 20, and a brief explanation.
1. Core Role Match (Skills, responsibilities)
2. Experience & Scope (Seniority, impact)
3. Education/Certifications
4. Soft Skills & Culture Fit
5. ATS/Keyword Alignment

Then, calculate the "overall_score" out of 100 (sum of the 5 criteria).
Finally, create a "coaching_plan" with 3-5 specific, actionable levers the candidate can pull to improve their resume for this specific role (e.g., "Highlight your Python data analysis experience more prominently", "Add the keyword 'Agile' to your project management bullet").

Return a JSON object with this EXACT structure:
{{
    "overall_score": 85,
    "criteria_scores": {{
        "core_role": {{"score": 18, "reason": "Explanation"}},
        "experience": {{"score": 15, "reason": "Explanation"}},
        "education": {{"score": 20, "reason": "Explanation"}},
        "culture": {{"score": 17, "reason": "Explanation"}},
        "ats_keywords": {{"score": 15, "reason": "Explanation"}}
    }},
    "coaching_plan": [
        "Actionable advice 1",
        "Actionable advice 2",
        "Actionable advice 3"
    ]
}}"""
}

class AIService:
    """Service for AI-powered resume tailoring using OpenAI."""
    
    def __init__(self):
        self.client = None
        self.anthropic_client = None
        self.gemini_model = None
        self.model_name = "gpt-4o-mini"
        self.load_config()

    def get_prompt(self, key: str) -> str:
        """Get a prompt by key, falling back to default."""
        return self.prompts.get(key, DEFAULT_PROMPTS.get(key, ""))

    def _has_active_client(self) -> bool:
        """Check if any AI client is initialized."""
        return bool(self.client or self.anthropic_client or self.gemini_model)

    def _clean_urls(self, text: str) -> str:
        """Remove http://, https://, and www. from URLs."""
        if not isinstance(text, str):
            return text
        # Remove protocol
        text = re.sub(r'https?://', '', text)
        # Remove www.
        text = re.sub(r'\bwww\.', '', text)
        return text

    def _parse_json_response(self, content: str) -> dict:
        """Helper to parse JSON from AI response, stripping markdown formatting if present."""
        if not content:
            return {}
            
        content = content.strip()
        
        # Remove markdown code formatting
        if content.startswith("```"):
            # Find the end of the first line (e.g., ```json)
            first_newline_idx = content.find("\n")
            if first_newline_idx != -1:
                content = content[first_newline_idx+1:]
            else:
                content = content[3:]  # just remove ```
                
            # Remove trailing ```
            if content.endswith("```"):
                content = content[:-3]
                
        content = content.strip()
        
        # Try finding the first { or [ and last } or ]
        try:
            # strict=False allows control characters (like literal newlines) in strings
            return json.loads(content, strict=False)
        except json.JSONDecodeError as e:
            # Attempt to fix common AI-isms
            # 1. Replace True/False/None with true/false/null
            content_fixed = re.sub(r'\bTrue\b', 'true', content)
            content_fixed = re.sub(r'\bFalse\b', 'false', content_fixed)
            content_fixed = re.sub(r'\bNone\b', 'null', content_fixed)
            
            # 2. Fix missing commas between fields (e.g. "field": "val" \n "next": "val")
            # This regex looks for double quotes followed by a colon, preceded by a closing quote/bracket on a previous line
            content_fixed = re.sub(r'("|\d|true|false|null|\]|\})\s*\n\s*"', r'\1,\n"', content_fixed)

            # Fallback for weird formatting (e.g. text before/after JSON)
            match = re.search(r'(\{.*\}|\[.*\])', content_fixed, re.DOTALL)
            if match:
                json_part = match.group(1)
                try:
                    return json.loads(json_part, strict=False)
                except:
                    # Final attempt: try to fix common issues like trailing commas
                    cleaned_json = re.sub(r',\s*([}\]])', r'\1', json_part)
                    try:
                        return json.loads(cleaned_json, strict=False)
                    except:
                        pass
            # Re-raise original exception if nothing worked
            raise e

    def load_config(self):
        """Load configuration from config.json and initialize AI clients."""
        config_path = "config.json"
        config = {}
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                try:
                    config = json.load(f)
                except:
                    pass
        
        # Load Prompts
        self.prompts = config.get("prompts", DEFAULT_PROMPTS.copy())
        # Ensure all default keys exist and are NOT empty strings
        for k, v in DEFAULT_PROMPTS.items():
            if k not in self.prompts or not self.prompts[k].strip():
                self.prompts[k] = v
        
        # AI Config
        ai_config = config.get("ai_config", {})
        self.provider = ai_config.get("provider", "openai") 
        # Providers: openai, anthropic, gemini, local, openrouter, azure, deepseek, mistral, etc (via openai-compat)
        
        self.model_name = ai_config.get("model", "gpt-4o-mini")
        
        api_key = ai_config.get("api_key") or os.getenv(f"{self.provider.upper()}_API_KEY")
        base_url = ai_config.get("base_url")

        # 1. OpenAI / Compatible (Local, OpenRouter, Azure, DeepSeek, Mistral, Groq)
        if self.provider in ["openai", "local", "openrouter", "deepseek", "mistral", "azure", "groq", "meta", "alibaba"]:
            kwargs = {}
            if api_key: kwargs["api_key"] = api_key
            else: kwargs["api_key"] = "dummy" # Local might not need it
            
            if base_url: kwargs["base_url"] = base_url
            elif self.provider == "openrouter": kwargs["base_url"] = "https://openrouter.ai/api/v1"
            elif self.provider == "deepseek": kwargs["base_url"] = "https://api.deepseek.com"
            elif self.provider == "mistral": kwargs["base_url"] = "https://api.mistral.ai/v1"
            
            # Default to env var if official OpenAI
            if self.provider == "openai" and not api_key:
                kwargs["api_key"] = os.getenv("OPENAI_API_KEY")

            try:
                self.client = OpenAI(**kwargs)
                print(f"✅ AI Initialized: {self.provider} ({self.model_name})")
            except Exception as e:
                print(f"❌ Error init OpenAI-compat client: {e}")
                self.client = None

        # 2. Anthropic
        elif self.provider == "anthropic":
            if not api_key: api_key = os.getenv("ANTHROPIC_API_KEY")
            try:
                self.anthropic_client = anthropic.Anthropic(api_key=api_key)
                print(f"✅ AI Initialized: Anthropic ({self.model_name})")
            except Exception as e:
                print(f"❌ Error init Anthropic: {e}")

        # 3. Google Gemini
        elif self.provider == "gemini":
            if not api_key: api_key = os.getenv("GOOGLE_API_KEY")
            try:
                genai.configure(api_key=api_key)
                self.gemini_model = genai.GenerativeModel(self.model_name)
                print(f"✅ AI Initialized: Gemini ({self.model_name})")
            except Exception as e:
                print(f"❌ Error init Gemini: {e}")

    async def execute_ai_request(self, system_prompt: str, user_prompt: str, response_format="json_object", temperature=0.7) -> str:
        """Unified executor for all AI providers."""
        try:
            # --- OpenAI Compatible ---
            if self.client:
                # Certain models (like o1, o3, gpt-5) don't support temperature settings other than 1
                # We omit temperature for these to avoid errors
                is_reasoning_model = any(x in self.model_name.lower() for x in ["o1", "o3", "gpt-5"])
                
                request_kwargs = {
                    "model": self.model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "response_format": {"type": "json_object"} if response_format == "json_object" and self.provider in ["openai", "openrouter", "deepseek"] else None,
                }
                
                if not is_reasoning_model:
                    request_kwargs["temperature"] = temperature

                raw_response = self.client.chat.completions.create(**request_kwargs)
                content = raw_response.choices[0].message.content
                return content

            # --- Anthropic ---
            elif self.anthropic_client:
                # Claude handles system prompt separately
                message = self.anthropic_client.messages.create(
                    model=self.model_name,
                    max_tokens=4096,
                    temperature=temperature,
                    system=system_prompt,
                    messages=[
                        {"role": "user", "content": user_prompt}
                    ]
                )
                return message.content[0].text

            # --- Google Gemini ---
            elif self.gemini_model:
                # Google GenAI setup
                # Note: System instructions are configured at model init usually, but we can prepend to prompt
                full_prompt = f"System Instruction: {system_prompt}\n\nUser Request: {user_prompt}"
                
                # Gemini JSON mode (for newer models)
                generation_config = genai.types.GenerationConfig(
                    temperature=temperature,
                    response_mime_type="application/json" if response_format == "json_object" else "text/plain"
                )
                
                response = self.gemini_model.generate_content(
                    full_prompt,
                    generation_config=generation_config
                )
                return response.text
                
            else:
                raise Exception("No AI client initialized for current provider.")

        except Exception as e:
            raise Exception(f"AI Provider Error ({self.provider}): {str(e)}")

    
    async def analyze_job_description(self, job_description: str) -> Dict[str, Any]:
        """
        Analyze a job description to extract key requirements, skills, and metadata.
        """
        if not self._has_active_client():
            return {
                "error": "AI client not initialized",
                "skills": [],
                "keywords": [],
                "requirements": [],
                "metadata": {}
            }
        
        current_date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        prompt_template = self.get_prompt("analyze_job")
        prompt = prompt_template.format(job_description=job_description, current_date=current_date_str)
        
        
        try:
            content = await self.execute_ai_request(
                system_prompt="You are an expert job market analyst. Extract structured data from job descriptions.",
                user_prompt=prompt,
                response_format="json_object",
                temperature=0.3
            )
            analysis = self._parse_json_response(content)
            return analysis
            
        except Exception as e:
            print(f"Error analyzing job description: {e}")
            raise e
    
    async def tailor_resume(self, resume_data: Dict[str, Any], job_description: str, additional_context: str = "", instructions: str = "") -> Dict[str, Any]:
        """
        Tailor a resume based on job description while maintaining formatting.
        Includes additional context and custom instructions if provided.
        """
        if not self._has_active_client():
            # Return original resume if no AI available
            return resume_data
        
        # First, analyze the job
        job_analysis = await self.analyze_job_description(job_description)
        
        # Save original contact info to protect it
        full_text_original = resume_data.get("full_text", [])
        contact_header = full_text_original[:4] if len(full_text_original) > 4 else []
            
        prompt_template = self.get_prompt("tailor_resume")
        
        # Build context string
        additional_context_instr = ""
        if additional_context:
            additional_context_instr = f"\n\nADDITIONAL CONTEXT DOCUMENTS:\n{additional_context}\n\nINSTRUCTION: Use the above context documents to find more detailed project info, specific metrics, or achievements that might not be in the base resume but are relevant to the job. Use this to enhance the tailored bullet points."

        # Ensure we pass the entire resume_data
        prompt = prompt_template.format(
            resume_data=json.dumps(resume_data, indent=2),
            job_description=job_description,
            job_analysis=json.dumps(job_analysis, indent=2),
            item_count=len(full_text_original),
            additional_context_instr=additional_context_instr,
            instructions=f"\n\nCUSTOM USER INSTRUCTIONS:\n{instructions}\n" if instructions else ""
        )
        
        try:
            content = await self.execute_ai_request(
                system_prompt="You are an expert resume writer who tailors resumes while maintaining authenticity and structure.",
                user_prompt=prompt,
                response_format="json_object",
                temperature=0.5
            )
             
            tailored_resume = self._parse_json_response(content)
            
            # ATTACH METADATA
            if "metadata" in job_analysis:
                tailored_resume["job_metadata"] = job_analysis["metadata"]
            
            # Basic validation: ensure full_text exists
            if "full_text" not in tailored_resume:
                print("⚠️ AI forgot full_text in tailor_resume, reconstructing...")
                reconstructed_full_text = []
                for section in tailored_resume.get("sections", []):
                    if section.get("title") and section.get("type") != "table":
                        reconstructed_full_text.append(section["title"])
                    for item in section.get("content", []):
                        if item:
                            reconstructed_full_text.append(str(item))
                tailored_resume["full_text"] = reconstructed_full_text

            # RECOMBINE: Restore the protected contact info to the beginning of full_text
            tailored_body = tailored_resume.get("full_text", [])
            
            # First clean URLs in the AI generated parts
            cleaned_tailored_body = [self._clean_urls(t) for t in tailored_body]
            
            if contact_header and len(cleaned_tailored_body) >= len(contact_header):
                # Check for item count mismatch
                if len(cleaned_tailored_body) != len(full_text_original):
                    print(f"⚠️ Warning: AI returned {len(cleaned_tailored_body)} items, expected {len(full_text_original)}")
                
                # Overwrite the first 4 items to protect them EXACTLY as they were
                for i in range(len(contact_header)):
                    cleaned_tailored_body[i] = contact_header[i]
            
            tailored_resume["full_text"] = cleaned_tailored_body

                
            return tailored_resume
            
        except Exception as e:
            print(f"Error tailoring resume: {e}")
            raise e

    async def refine_resume(self, resume_data: Dict[str, Any], refinement_instructions: str, additional_context: str = "") -> Dict[str, Any]:
        """
        Refine an existing resume revision based on user instructions.
        """
        if not self._has_active_client():
            return resume_data
            
        prompt_template = self.get_prompt("refine_resume")
        
        additional_context_instr = ""
        if additional_context:
            additional_context_instr = f"\nADDITIONAL CONTEXT DOCUMENTS:\n{additional_context}\n"

        prompt = prompt_template.format(
            resume_data=json.dumps(resume_data, indent=2),
            instructions=refinement_instructions,
            additional_context_instr=additional_context_instr
        )
        
        try:
            content = await self.execute_ai_request(
                system_prompt="You are a helpful resume editor.",
                user_prompt=prompt,
                response_format="json_object",
                temperature=0.4
            )
            
            refined_resume = self._parse_json_response(content)
            
            # Basic validation
            if "full_text" not in refined_resume:
                # Attempt to reconstruct full_text if AI forgot it
                print("⚠️ AI forgot full_text, reconstructing...")
                full_text = []
                for section in refined_resume.get("sections", []):
                    if section.get("title"): full_text.append(section["title"])
                    full_text.extend(section.get("content", []))
                refined_resume["full_text"] = full_text
            
            # Clean URLs in the refined content
            if "full_text" in refined_resume:
                refined_resume["full_text"] = [self._clean_urls(t) for t in refined_resume["full_text"]]
            
            return refined_resume
            
        except Exception as e:
            print(f"Error refining resume: {e}")
            resume_data["change_summary"] = [f"Error: {str(e)}"]
            return resume_data

    async def extract_profile_data(self, resume_text: str) -> Dict[str, Any]:
        """Extract structured profile data (contact, skills, experience, education) from resume text."""
        if not self._has_active_client():
            return {}
            
        prompt_template = self.get_prompt("extract_profile")
        prompt = prompt_template.format(resume_text=resume_text[:10000])
        
        try:
            content = await self.execute_ai_request(
                system_prompt="You are a data extraction assistant. Extract structured profile data.",
                user_prompt=prompt,
                response_format="json_object",
                temperature=0.1
            )
            data = self._parse_json_response(content)
            
            # Flatten for easier frontend consumption?
            # Actually, let's keep it structured but merged by caller or flatten here.
            # The backend expects a flat profile object with "skills", "experiences", "educations" as keys
            
            flat_profile = data.get("contact_info", {})
            flat_profile["skills"] = data.get("skills", [])
            flat_profile["experiences"] = data.get("experiences", [])
            flat_profile["educations"] = data.get("educations", [])
            flat_profile["certificates"] = data.get("certificates", [])
            flat_profile["other"] = data.get("other", [])
            
            # Clean URLs
            for url_key in ["linkedin_url", "github_url", "website_url"]:
                if flat_profile.get(url_key):
                    flat_profile[url_key] = self._clean_urls(flat_profile[url_key])
            
            return flat_profile
            
        except Exception as e:
            print(f"Error extracting profile data: {e}")
            return {}

    async def score_job_match(self, resume_text: str, job_description: str, additional_context: str = "") -> Dict[str, Any]:
        """Assess the match between resume and job description, returning a score and coaching plan."""
        if not self._has_active_client():
            return {
                "overall_score": 0,
                "criteria_scores": {},
                "coaching_plan": ["AI Client not initialized."]
            }

        current_date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        prompt_template = self.get_prompt("score_job_match")
        
        additional_context_instr = ""
        if additional_context:
            additional_context_instr = f"\n\nADDITIONAL CONTEXT DOCUMENTS:\n{additional_context}\n\nINSTRUCTION: Use these extra context documents to find more detailed information that might make the candidate a better fit."

        prompt = prompt_template.format(
            current_date=current_date_str,
            resume_text=resume_text[:10000],
            job_description=job_description[:10000],
            additional_context_instr=additional_context_instr
        )
        
        try:
            content = await self.execute_ai_request(
                system_prompt="You are an expert technical recruiter and career coach.",
                user_prompt=prompt,
                response_format="json_object",
                temperature=0.3
            )
            analysis = self._parse_json_response(content)
            return analysis
        except Exception as e:
            print(f"Error scoring job match: {e}")
            return {
                "overall_score": 0,
                "criteria_scores": {},
                "coaching_plan": [f"Error occurred during scoring: {str(e)}"]
            }

    async def generate_cover_letter(self, resume_text: str, job_description: str, user_profile: Dict[str, Any] = None, additional_context: str = "", instructions: str = "") -> Dict[str, Any]:
        """
        Generate a cover letter based on the resume and job description.
        If user_profile is provided, ensure the header uses that info.
        Includes additional context and custom instructions if provided.
        """
        if not self._has_active_client():
            return {"content": "AI Client not initialized."}

        current_date = datetime.now().strftime("%B %d, %Y")

        profile_context = ""
        if user_profile:
            # Build profile context dynamically to only include available fields
            profile_lines = [f"Name: {user_profile.get('full_name')}"]
            
            # Address
            addr_parts = [
                user_profile.get('address_line1'), 
                user_profile.get('address_line2'), 
                user_profile.get('city'), 
                user_profile.get('state'), 
                user_profile.get('zip_code')
            ]
            full_addr = ", ".join([p for p in addr_parts if p])
            if full_addr:
                profile_lines.append(f"Address: {full_addr}")
                
            if user_profile.get('email'): profile_lines.append(f"Email: {user_profile.get('email')}")
            if user_profile.get('phone_primary'): profile_lines.append(f"Phone: {user_profile.get('phone_primary')}")
            if user_profile.get('linkedin_url'): profile_lines.append(f"LinkedIn: {user_profile.get('linkedin_url')}")
            if user_profile.get('website_url'): profile_lines.append(f"Portfolio/Website: {user_profile.get('website_url')}")
            
            profile_context = "\n".join(profile_lines)

        prompt_template = self.get_prompt("generate_cover_letter")
        
        # Build context string
        additional_context_instr = ""
        if additional_context:
            additional_context_instr = f"\n\nADDITIONAL CONTEXT DOCUMENTS:\n{additional_context}\n\nINSTRUCTION: Incorporate relevant details, projects, or specific achievements found in these additional context documents to make the cover letter more personalized and demonstrate a stronger fit for the role."

        prompt = prompt_template.format(
            current_date=current_date,
            profile_context=profile_context,
            resume_text=resume_text[:4000],
            job_description=job_description[:4000],
            additional_context_instr=additional_context_instr,
            instructions=f"\n\nCUSTOM USER INSTRUCTIONS:\n{instructions}\n" if instructions else ""
        )
        
        try:
            content = await self.execute_ai_request(
                system_prompt="You are a helpful expert career coach.",
                user_prompt=prompt,
                response_format="json_object",
                temperature=0.7
            )
            result = self._parse_json_response(content)
            if "content" in result:
                result["content"] = self._clean_urls(result["content"])
            return result
            
        except Exception as e:
            print(f"Error generating cover letter: {e}")
            return {"content": f"Error generating cover letter: {str(e)}"}

    async def refine_cover_letter(self, current_content: str, instructions: str, additional_context: str = "") -> Dict[str, Any]:
        """Refine cover letter text based on instructions."""
        if not self._has_active_client():
            return {"content": current_content}
            
        prompt_template = self.get_prompt("refine_cover_letter")

        additional_context_instr = ""
        if additional_context:
            additional_context_instr = f"\nADDITIONAL CONTEXT DOCUMENTS:\n{additional_context}\n"

        prompt = prompt_template.format(
            current_content=current_content,
            instructions=instructions,
            additional_context_instr=additional_context_instr
        )
        try:
            content = await self.execute_ai_request(
                system_prompt="You are a helpful writing assistant.",
                user_prompt=prompt,
                response_format="json_object"
            )
            result = self._parse_json_response(content)
            if "content" in result:
                result["content"] = self._clean_urls(result["content"])
            return result
        except Exception as e:
            return {"content": current_content}

    async def list_available_models(self, api_key: str, provider: str, base_url: str = None) -> List[str]:
        """Fetch available models from the provider."""
        try:
            # 1. Anthropic (Static List + API verification if possible)
            if provider == "anthropic":
                # Anthropic API does not support model listing via endpoint. Return known models.
                return [
                    "claude-3-5-sonnet-20240620",
                    "claude-3-opus-20240229",
                    "claude-3-sonnet-20240229",
                    "claude-3-haiku-20240307"
                ]

            # 2. Google Gemini
            if provider == "gemini":
                if not api_key: api_key = os.getenv("GOOGLE_API_KEY")
                genai.configure(api_key=api_key)
                
                # Fetch models that support 'generateContent'
                models = []
                for m in genai.list_models():
                    if 'generateContent' in m.supported_generation_methods:
                        # strip 'models/' prefix if present
                        name = m.name.replace("models/", "")
                        models.append(name)
                return sorted(models)

            # 3. OpenAI / Compatible (OpenRouter, Olama, LMStudio, etc)
            kwargs = {}
            if api_key: 
                kwargs["api_key"] = api_key
            elif provider == "openai":
                kwargs["api_key"] = os.getenv("OPENAI_API_KEY", "")
                
            if not kwargs.get("api_key"): kwargs["api_key"] = "dummy"
            
            if base_url: kwargs["base_url"] = base_url
            elif provider == "openrouter": kwargs["base_url"] = "https://openrouter.ai/api/v1"
            elif provider == "deepseek": kwargs["base_url"] = "https://api.deepseek.com"
            elif provider == "mistral": kwargs["base_url"] = "https://api.mistral.ai/v1"
            elif provider == "openai" and not api_key: kwargs["api_key"] = os.getenv("OPENAI_API_KEY", "")


            temp_client = OpenAI(**kwargs)
            response = temp_client.models.list()
            
            all_models = [m.id for m in response.data]
            
            # Filter for OpenAI/OpenRouter to valid chat models only
            if provider in ["openai", "openrouter"]:
                # Exclude obvious non-chat or incompatible models
                excludes = (
                    "audio", "realtime", "search", "transcribe", "tts", 
                    "embedding", "moderation", "dall-e", "whisper", 
                    "vision", "instruct", "math", "code", "med"
                )
                
                # For OpenAI specifically, we allow more prefixes
                if provider == "openai":
                    prefixes = ("gpt", "o1", "o3", "chatgpt")
                    chat_models = [
                        m for m in all_models 
                        if m.startswith(prefixes) 
                        and not any(x in m for x in excludes)
                    ]
                else:
                    # OpenRouter: harder to filter by prefix, so we filter by exclusion
                    # and common chat patterns
                    chat_models = [
                        m for m in all_models
                        if not any(x in m.lower() for x in excludes)
                        and any(x in m.lower() for x in ["chat", "gpt", "claude", "llama", "mistral", "mixtral", "qwen", "phi", "gemini"])
                    ]
                
                print(f"DEBUG: Filtered Chat Models ({len(chat_models)})", flush=True)
                return sorted(chat_models)
            
            return sorted(all_models)

        except Exception as e:
            logger.error(f"Error fetching models for {provider}: {e}")
            return []

