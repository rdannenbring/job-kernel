import asyncio
from services.ai_service import AIService

async def test():
    service = AIService()
    res = await service.extract_profile_data("John Doe\nSoftware Engineer")
    print(res)

if __name__ == "__main__":
    asyncio.run(test())
