import requests
import json

try:
    response = requests.get('http://localhost:8000/api/config')
    response.raise_for_status()
    print("Status Code:", response.status_code)
    print("Response JSON:", json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
