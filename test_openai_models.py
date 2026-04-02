import os
import asyncio
from services.ai_service import AIService
from dotenv import load_dotenv

load_dotenv("backend/.env")

async def test_models():
    service = AIService()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("No OpenAI API Key found")
        return
        
    models = await service.list_available_models(api_key, "openai")
    print("\nAvailable OpenAI Models:")
    for m in models:
        print(f" - {m}")

if __name__ == "__main__":
    asyncio.run(test_models())
