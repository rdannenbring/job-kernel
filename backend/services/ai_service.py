import os
from openai import OpenAI
import anthropic
import google.generativeai as genai
from typing import Dict, Any, List, Optional
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
        "company": "Extract company name. IMPORTANT: Do NOT use the platform name (e.g., 'LinkedIn', 'Indeed', 'Otta') as the company unless the job is ACTUALLY at and for that organization. If the employer name is not found, use 'Unknown Company'.",
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
4. **MODIFY CONTENT ONLY**: Only change the text content of professional experience/skills items, not the structure. Do NOT alter any formatting, spacing, or markup.
5. **NEVER DROP HEADERS**: You MUST perfectly copy over the applicant's Name, Contact Info, and ALL section headers (like "EXECUTIVE SUMMARY", "EXPERIENCE"). Do not drop these from the `full_text` array under any circumstances.
6. You MUST update the main professional title at the top of the resume to better match the target job title.
7. Keep all dates, company names, and PAST job titles (in the experience section) exactly unchanged.
8. Emphasize relevant experience by rewording bullet points to highlight matching skills
9. Add relevant keywords from the job description naturally into existing bullet points
10. Do NOT add new bullet points or sections
11. Do NOT remove bullet points or sections
12. **NO EMBELLISHMENT OR FABRICATION**: You MUST NOT hallucinate, invent, or fabricate any skills, experiences, metrics, or achievements that are not explicitly present in the ORIGINAL RESUME CONTENT or the ADDITIONAL CONTEXT DOCUMENTS. Your rewording must be strictly grounded in the actual data provided.
13. **URL FORMATTING**: If any web addresses are included (e.g., in Projects or Summary), CLEAN them by removing "http://", "https://", and "www." prefixes.
14. **PRESERVE ALL FORMATTING AND MARKUP**: You MUST keep all markdown syntax and formatting markers that were present in the original exactly as they were. Do not strip markdown formatting. Be precise in replacing ONLY the words/text content and NEVER the markup, structure, spacing, or special characters.

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
4. **PRESERVE ALL FORMATTING AND MARKUP**: You MUST exactly preserve any markdown or formatting characters from the original content. Only replace text content to address the instruction, leaving any markup around it unchanged.
5. **URL CLEANING**: Continue cleaning web addresses by removing "http://", "https://", and "www.".
6. **STRICTLY GROUNDED**: Do not fabricate, embellish, or hallucinate skills, metrics, or experiences. All changes and additions must be strictly grounded in the CURRENT RESUME DATA or the ADDITIONAL CONTEXT provided.

Return the updated resume in the SAME JSON structure as the input, with only the text content modified.

Additionally, include a "change_summary" field with a concise list of 3-5 bullet points explaining exactly what was updated based on the instructions (e.g. "Increased technical depth in the Experience section", "Emphasized leadership skills per your request").""",
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
5. **CONTENT**: Highlight specific achievements from the resume that align with the required skills. Use details from the additional context documents if provided to add more depth and personalization to the letter. Keep it to 3-4 paragraphs. **CRITICAL**: Do not invent, embellish, or fabricate any experiences, skills, or metrics not explicitly present in the provided resume or additional context.

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
    """Service for AI-powered resume tailoring using OpenAI, Anthropic, and Gemini."""
    
    def __init__(self):
        self.client = None
        self.anthropic_client = None
        self.gemini_model = None
        self.provider = "openai"
        self.model_name = "gpt-4o-mini"
        self.prompts = DEFAULT_PROMPTS.copy()
        self.load_config()

    def get_prompt(self, key: str, config: dict = None) -> str:
        """Get a prompt by key, falling back to user config or global defaults."""
        if config and "prompts" in config:
            return config["prompts"].get(key, self.prompts.get(key, DEFAULT_PROMPTS.get(key, "")))
        return self.prompts.get(key, DEFAULT_PROMPTS.get(key, ""))

    def _has_active_client(self) -> bool:
        """Check if any AI client is initialized."""
        return bool(self.client or self.anthropic_client or self.gemini_model)

    def _clean_urls(self, text: str) -> str:
        """Remove http://, https://, and www. from URLs."""
        if not isinstance(text, str):
            return text
        text = re.sub(r'https?://', '', text)
        text = re.sub(r'\bwww\.', '', text)
        return text

    def _parse_json_response(self, content: str) -> dict:
        """Helper to parse JSON from AI response, stripping markdown formatting if present."""
        if not content or not isinstance(content, str):
            return {}
            
        content = content.strip()
        if not content:
            return {}

        if content.startswith("Error:") or content.startswith("AI provider not configured"):
            logger.error(f"AI Error string passed to parser: {content}")
            return {}

        if content.startswith("```"):
            first_newline_idx = content.find("\n")
            if first_newline_idx != -1:
                content = content[first_newline_idx+1:]
            else:
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
        content = content.strip()
        try:
            return json.loads(content, strict=False)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON response. Attempting recovery. Content: {content[:200]}...")
            content_fixed = re.sub(r'\bTrue\b', 'true', content)
            content_fixed = re.sub(r'\bFalse\b', 'false', content_fixed)
            content_fixed = re.sub(r'\bNone\b', 'null', content_fixed)
            content_fixed = re.sub(r'("|\d|true|false|null|\]|\})\s*\n\s*"', r'\1,\n"', content_fixed)
            match = re.search(r'(\{.*\}|\[.*\])', content_fixed, re.DOTALL)
            if match:
                json_part = match.group(1)
                try:
                    return json.loads(json_part, strict=False)
                except:
                    cleaned_json = re.sub(r',\s*([}\]])', r'\1', json_part)
                    try:
                        return json.loads(cleaned_json, strict=False)
                    except:
                        pass
            logger.error(f"JSON recovery failed. Error: {e}")
            raise e

    def load_config(self):
        """Load configuration from config.json and initialize default global clients."""
        config_path = "config.json"
        config = {}
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                try:
                    config = json.load(f)
                except:
                    pass
        
        self.prompts = config.get("prompts", DEFAULT_PROMPTS.copy())
        for k, v in DEFAULT_PROMPTS.items():
            if k not in self.prompts or not self.prompts[k].strip():
                self.prompts[k] = v
        
        ai_config = config.get("ai_config", {})
        self.provider = ai_config.get("provider", "openai") 
        self.model_name = ai_config.get(f"{self.provider}_model") or ai_config.get("model", "gpt-4o-mini")
        api_key = ai_config.get(f"{self.provider}_api_key") or ai_config.get("api_key") or os.getenv(f"{self.provider.upper()}_API_KEY")
        base_url = ai_config.get(f"{self.provider}_base_url") or ai_config.get("base_url") or os.getenv(f"{self.provider.upper()}_API_BASE")

        if self.provider in ["openai", "local", "openrouter", "deepseek", "mistral", "azure", "groq", "meta", "alibaba", "ollama"]:
            kwargs = {"api_key": api_key or "dummy"}
            if base_url: kwargs["base_url"] = base_url
            elif self.provider == "openrouter": kwargs["base_url"] = "https://openrouter.ai/api/v1"
            elif self.provider == "deepseek": kwargs["base_url"] = "https://api.deepseek.com"
            elif self.provider == "mistral": kwargs["base_url"] = "https://api.mistral.ai/v1"
            if self.provider == "openai" and not api_key:
                kwargs["api_key"] = os.getenv("OPENAI_API_KEY")
            try:
                self.client = OpenAI(**kwargs)
                print(f"✅ AI Initialized: {self.provider} ({self.model_name})")
            except Exception as e:
                print(f"❌ Error init OpenAI client: {e}")
                self.client = None
        elif self.provider == "anthropic":
            if not api_key: api_key = os.getenv("ANTHROPIC_API_KEY")
            try:
                self.anthropic_client = anthropic.Anthropic(api_key=api_key)
                print(f"✅ AI Initialized: Anthropic ({self.model_name})")
            except Exception as e:
                print(f"❌ Error init Anthropic: {e}")
        elif self.provider == "gemini":
            if not api_key: api_key = os.getenv("GOOGLE_API_KEY")
            try:
                genai.configure(api_key=api_key)
                self.gemini_model = genai.GenerativeModel(self.model_name)
                print(f"✅ AI Initialized: Gemini ({self.model_name})")
            except Exception as e:
                print(f"❌ Error init Gemini: {e}")

    async def execute_ai_request(self, system_prompt: str, user_prompt: str, response_format: str = "text", temperature: float = 0.7, config: dict = None) -> str:
        """Unified executor for all AI providers, supports per-call config."""
        provider = self.provider
        model_name = self.model_name
        api_key = None
        base_url = None
        
        if config and "ai_config" in config:
            ai_config = config["ai_config"]
            provider = ai_config.get("provider", provider)
            model_name = ai_config.get(f"{provider}_model") or ai_config.get("model", model_name)
            api_key = ai_config.get(f"{provider}_api_key") or ai_config.get("api_key") or os.getenv(f"{provider.upper()}_API_KEY")
            base_url = ai_config.get(f"{provider}_base_url") or ai_config.get("base_url") or os.getenv(f"{provider.upper()}_API_BASE")
            
            if provider in ["openai", "local", "openrouter", "deepseek", "mistral", "azure", "groq", "meta", "alibaba", "ollama"]:
                temp_client = OpenAI(api_key=api_key or "dummy", base_url=base_url)
                if provider == "openrouter" and not base_url:
                    temp_client.base_url = "https://openrouter.ai/api/v1"
                is_reasoning_model = any(x in model_name.lower() for x in ["o1", "o3", "gpt-5"])
                request_kwargs = {
                    "model": model_name,
                    "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                    "response_format": {"type": "json_object"} if response_format == "json_object" else None,
                }
                if not is_reasoning_model: request_kwargs["temperature"] = temperature
                response = temp_client.chat.completions.create(**request_kwargs)
                return response.choices[0].message.content
            elif provider == "gemini":
                if api_key: genai.configure(api_key=api_key)
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(
                    f"{system_prompt}\n\n{user_prompt}",
                    generation_config=genai.types.GenerationConfig(
                        temperature=temperature,
                        response_mime_type="application/json" if response_format == "json_object" else "text/plain"
                    )
                )
                if not response.text:
                    logger.warning(f"Gemini returned empty text. Response: {response}")
                    return ""
                return response.text
            elif provider == "anthropic":
                temp_client = anthropic.Anthropic(api_key=api_key)
                response = temp_client.messages.create(
                    model=model_name, max_tokens=4096, system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}], temperature=temperature
                )
                return response.content[0].text

        if not self._has_active_client():
            raise Exception("AI provider not configured")
            
        if self.provider in ["openai", "local", "openrouter", "deepseek", "mistral", "azure", "groq", "meta", "alibaba", "ollama"]:
            is_reasoning_model = any(x in self.model_name.lower() for x in ["o1", "o3", "gpt-5"])
            request_kwargs = {
                "model": self.model_name,
                "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                "response_format": {"type": "json_object"} if response_format == "json_object" else None,
            }
            if not is_reasoning_model: request_kwargs["temperature"] = temperature
            response = self.client.chat.completions.create(**request_kwargs)
            return response.choices[0].message.content
        elif self.provider == "anthropic":
            response = self.anthropic_client.messages.create(
                model=self.model_name, max_tokens=4096, system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}], temperature=temperature
            )
            return response.content[0].text
        elif self.provider == "gemini":
            response = self.gemini_model.generate_content(
                f"{system_prompt}\n\n{user_prompt}",
                generation_config=genai.types.GenerationConfig(
                    temperature=temperature,
                    response_mime_type="application/json" if response_format == "json_object" else "text/plain"
                )
            )
            if not response.text:
                logger.warning(f"Gemini returned empty text. Response: {response}")
                return ""
            return response.text
        
        raise Exception(f"Unsupported or unconfigured AI provider: {self.provider}")

    async def analyze_job_description(self, job_description: str, config: dict = None) -> Dict[str, Any]:
        """Analyze a job description using optional per-user config."""
        current_date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        prompt_template = self.get_prompt("analyze_job", config)
        prompt = prompt_template.format(job_description=job_description, current_date=current_date_str)
        try:
            content = await self.execute_ai_request(
                system_prompt="You are an expert job market analyst.",
                user_prompt=prompt, response_format="json_object", temperature=0.3, config=config
            )
            return self._parse_json_response(content)
        except Exception as e:
            print(f"Error analyzing job description: {e}")
            return {"error": str(e), "skills": [], "keywords": [], "metadata": {}}

    async def tailor_resume(self, resume_data: Dict[str, Any], job_description: str, additional_context: str = "", instructions: str = "", config: dict = None) -> Dict[str, Any]:
        """Tailor a resume based on job description using optional per-user config."""
        job_analysis = await self.analyze_job_description(job_description, config)
        full_text_original = resume_data.get("full_text", [])
        contact_header = full_text_original[:4] if len(full_text_original) > 4 else []
        prompt_template = self.get_prompt("tailor_resume", config)
        
        additional_context_instr = ""
        if additional_context:
            additional_context_instr = f"\n\nADDITIONAL CONTEXT DOCUMENTS:\n{additional_context}\n\nINSTRUCTION: Use context to enhance bullet points."

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
                system_prompt="You are an expert resume writer.",
                user_prompt=prompt, response_format="json_object", temperature=0.5, config=config
            )
            tailored_resume = self._parse_json_response(content)
            if "metadata" in job_analysis: tailored_resume["job_metadata"] = job_analysis["metadata"]
            
            tailored_body = tailored_resume.get("full_text", [])
            cleaned_tailored_body = [self._clean_urls(t) for t in tailored_body]
            if contact_header and len(cleaned_tailored_body) >= len(contact_header):
                for i in range(len(contact_header)): cleaned_tailored_body[i] = contact_header[i]
            tailored_resume["full_text"] = cleaned_tailored_body
            return tailored_resume
        except Exception as e:
            print(f"Error tailoring resume: {e}")
            return resume_data

    async def refine_resume(self, resume_data: Dict[str, Any], refinement_instructions: str, additional_context: str = "", config: dict = None) -> Dict[str, Any]:
        """Refine a resume using optional per-user config."""
        prompt_template = self.get_prompt("refine_resume", config)
        additional_context_instr = f"\nADDITIONAL CONTEXT DOCUMENTS:\n{additional_context}\n" if additional_context else ""
        prompt = prompt_template.format(
            resume_data=json.dumps(resume_data, indent=2),
            instructions=refinement_instructions,
            additional_context_instr=additional_context_instr
        )
        try:
            content = await self.execute_ai_request(
                system_prompt="You are a helpful resume editor.",
                user_prompt=prompt, response_format="json_object", temperature=0.4, config=config
            )
            refined_resume = self._parse_json_response(content)
            if "full_text" in refined_resume:
                refined_resume["full_text"] = [self._clean_urls(t) for t in refined_resume["full_text"]]
            return refined_resume
        except Exception as e:
            print(f"Error refining resume: {e}")
            return resume_data

    async def extract_profile_data(self, resume_text: str, config: dict = None) -> Dict[str, Any]:
        """Extract profile data using optional per-user config."""
        prompt_template = self.get_prompt("extract_profile", config)
        prompt = prompt_template.format(resume_text=resume_text[:10000])
        try:
            content = await self.execute_ai_request(
                system_prompt="You are a data extraction assistant.",
                user_prompt=prompt, response_format="json_object", temperature=0.1, config=config
            )
            data = self._parse_json_response(content)
            flat_profile = data.get("contact_info", {})
            for key in ["skills", "experiences", "educations", "certificates", "other"]:
                flat_profile[key] = data.get(key, [])
            for url_key in ["linkedin_url", "github_url", "website_url"]:
                if flat_profile.get(url_key): flat_profile[url_key] = self._clean_urls(flat_profile[url_key])
            return flat_profile
        except Exception as e:
            print(f"Error extracting profile data: {e}")
            return {}

    async def list_available_models(self, provider: str = None, api_key: str = None, base_url: str = None) -> List[str]:
        """
        Fetch the list of available model IDs from the configured provider.
        Returns a sorted list of model ID strings.
        """
        import asyncio, httpx

        provider = provider or self.provider
        api_key  = api_key  or os.getenv(f"{provider.upper()}_API_KEY", "")

        # ── Anthropic: no public /models listing — return curated static list ──
        if provider == "anthropic":
            return [
                "claude-opus-4-5",
                "claude-sonnet-4-5",
                "claude-opus-4-0",
                "claude-sonnet-4-0",
                "claude-haiku-4-0",
                "claude-3-7-sonnet-latest",
                "claude-3-5-sonnet-latest",
                "claude-3-5-haiku-latest",
                "claude-3-opus-latest",
            ]

        # ── Gemini: use the REST models endpoint ──────────────────────────────
        if provider == "gemini":
            if not api_key:
                api_key = os.getenv("GOOGLE_API_KEY", "")
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}&pageSize=100"
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                models = []
                for m in data.get("models", []):
                    name = m.get("name", "")          # e.g. "models/gemini-1.5-flash"
                    methods = m.get("supportedGenerationMethods", [])
                    if "generateContent" in methods:
                        model_id = name.replace("models/", "")
                        models.append(model_id)
                return sorted(models)
            except Exception as e:
                print(f"Error fetching Gemini models: {e}")
                # Curated fallback
                return [
                    "gemini-2.5-pro-preview-03-25",
                    "gemini-2.0-flash",
                    "gemini-2.0-flash-lite",
                    "gemini-1.5-pro-latest",
                    "gemini-1.5-flash-latest",
                ]

        # ── OpenAI-compatible: call /models ───────────────────────────────────
        provider_base_urls = {
            "openai":     "https://api.openai.com/v1",
            "openrouter": "https://openrouter.ai/api/v1",
            "deepseek":   "https://api.deepseek.com",
            "mistral":    "https://api.mistral.ai/v1",
            "groq":       "https://api.groq.com/openai/v1",
            "alibaba":    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
            "ollama":     "http://127.0.0.1:11434/v1",
            "local":      "http://127.0.0.1:8080/v1",
        }
        resolved_base = base_url or os.getenv(f"{provider.upper()}_API_BASE") or provider_base_urls.get(provider, "")
        if not resolved_base:
            return []
        resolved_base = resolved_base.rstrip("/")

        try:
            headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(f"{resolved_base}/models", headers=headers)
            resp.raise_for_status()
            data = resp.json()
            # OpenAI format: {"data": [{"id": "gpt-4o", ...}, ...]}
            raw = data.get("data", data) if isinstance(data, dict) else data
            ids = []
            for m in raw:
                if isinstance(m, dict):
                    ids.append(m.get("id") or m.get("name") or "")
                elif isinstance(m, str):
                    ids.append(m)
            return sorted(id_ for id_ in ids if id_)
        except Exception as e:
            print(f"Error fetching models from {resolved_base}: {e}")
            return []

    async def score_job_match(self, resume_text: str, job_description: str, additional_context: str = "", config: dict = None) -> Dict[str, Any]:
        """Score job match using optional per-user config."""
        current_date_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        prompt_template = self.get_prompt("score_job_match", config)
        additional_context_instr = f"\n\nADDITIONAL CONTEXT:\n{additional_context}" if additional_context else ""
        prompt = prompt_template.format(
            current_date=current_date_str, resume_text=resume_text[:10000],
            job_description=job_description[:10000], additional_context_instr=additional_context_instr
        )
        try:
            content = await self.execute_ai_request(
                system_prompt="You are an expert technical recruiter.",
                user_prompt=prompt, response_format="json_object", temperature=0.3, config=config
            )
            return self._parse_json_response(content)
        except Exception as e:
            print(f"Error scoring job match: {e}")
            return {"overall_score": 0, "coaching_plan": [str(e)]}

    async def generate_cover_letter(self, resume_text: str, job_description: str, user_profile: Dict[str, Any] = None, additional_context: str = "", example_cover_letter: str = "", instructions: str = "", config: dict = None) -> Dict[str, Any]:
        """Generate cover letter using optional per-user config."""
        current_date = datetime.now().strftime("%B %d, %Y")
        profile_context = ""
        if user_profile:
            profile_lines = [f"Name: {user_profile.get('full_name')}"]
            addr = ", ".join([p for p in [user_profile.get('address_line1'), user_profile.get('city'), user_profile.get('state')] if p])
            if addr: profile_lines.append(f"Address: {addr}")
            for k, label in [('email', 'Email'), ('phone_primary', 'Phone'), ('linkedin_url', 'LinkedIn')]:
                if user_profile.get(k): profile_lines.append(f"{label}: {user_profile.get(k)}")
            profile_context = "\n".join(profile_lines)

        prompt_template = self.get_prompt("generate_cover_letter", config)
        additional_context_instr = f"\n\nCONTEXT:\n{additional_context}" if additional_context else ""
        
        if example_cover_letter:
            additional_context_instr += f"\n\nEXAMPLE COVER LETTER (FOR FORMATTING/TONE/STYLE REFERENCE):\n{example_cover_letter}\n\nINSTRUCTION: Emulate the formatting, structure, and professional tone of this example letter while using the candidate's actual data."

        prompt = prompt_template.format(
            current_date=current_date, profile_context=profile_context,
            resume_text=resume_text[:4000], job_description=job_description[:4000],
            additional_context_instr=additional_context_instr,
            instructions=f"\n\nCUSTOM INSTRUCTIONS:\n{instructions}\n" if instructions else ""
        )
        try:
            content = await self.execute_ai_request(
                system_prompt="You are a career coach.",
                user_prompt=prompt, response_format="json_object", temperature=0.7, config=config
            )
            result = self._parse_json_response(content)
            if "content" in result: result["content"] = self._clean_urls(result["content"])
            return result
        except Exception as e:
            print(f"Error generating cover letter: {e}")
            return {"content": str(e)}
