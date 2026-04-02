import re

with open('backend/main.py', 'r') as f:
    content = f.read()

# 1. Imports
if 'BackgroundTasks' not in content:
    content = content.replace("from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request", "from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, BackgroundTasks")
if 'import requests' not in content:
    content = content.replace("import json", "import json\nimport requests")

# 2. Calculation logic
calc_logic = """

def calculate_commute_for_app(app_id: int):
    # Retrieve app to get location
    app = database_service.get_application_by_id(app_id)
    if not app: return
    
    dest_str = app.get('location')
    if not dest_str or 'remote' in dest_str.lower() or str(app.get('location_type', '')).lower() == 'remote':
        database_service.update_application(app_id, {'commute_time_mins': 0, 'commute_distance_miles': 0.0})
        return
        
    profile = database_service.get_profile()
    if not profile: return
    
    origin_parts = []
    if profile.get('address_line1'): origin_parts.append(profile['address_line1'])
    if profile.get('city'): origin_parts.append(profile['city'])
    if profile.get('state'): origin_parts.append(profile['state'])
    origin_str = ", ".join(origin_parts)
    if not origin_str: return
    
    try:
        r1 = requests.get(f"https://nominatim.openstreetmap.org/search?format=json&q={origin_str}&limit=1", headers={'Accept-Language': 'en', 'User-Agent': 'JobAppTracker'})
        r1.raise_for_status()
        loc1 = r1.json()
        
        r2 = requests.get(f"https://nominatim.openstreetmap.org/search?format=json&q={dest_str}&limit=1", headers={'Accept-Language': 'en', 'User-Agent': 'JobAppTracker'})
        r2.raise_for_status()
        loc2 = r2.json()
        
        if loc1 and loc2:
            lon1, lat1 = loc1[0]['lon'], loc1[0]['lat']
            lon2, lat2 = loc2[0]['lon'], loc2[0]['lat']
            route_res = requests.get(f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false")
            route_res.raise_for_status()
            route_data = route_res.json()
            if route_data.get('code') == 'Ok' and route_data.get('routes'):
                dist_miles = float((route_data['routes'][0]['distance'] * 0.000621371))
                mins = int(round(route_data['routes'][0]['duration'] / 60))
                database_service.update_application(app_id, {
                    'commute_time_mins': mins,
                    'commute_distance_miles': dist_miles
                })
    except Exception as e:
        print(f"Error calculating commute for app {app_id}: {e}")

@app.post("/api/profile/recalculate-commutes")
async def recalculate_commutes(background_tasks: BackgroundTasks):
    apps = database_service.get_applications()
    for ap in apps:
        background_tasks.add_task(calculate_commute_for_app, ap['id'])
    return {"message": "Recalculation started in background."}
"""

if 'def calculate_commute_for_app' not in content:
    content = content.replace("class RefineRequest(BaseModel):", calc_logic + "\nclass RefineRequest(BaseModel):")

# 3. Patch save_application
if 'background_tasks: BackgroundTasks' not in content.split('def save_application(')[1].split('):')[0]:
    content = content.replace("async def save_application(request: ApplicationSaveRequest):", "async def save_application(request: ApplicationSaveRequest, background_tasks: BackgroundTasks):")
    content = content.replace(
        "return {\"message\": \"Application saved\", \"id\": app_id}",
        "background_tasks.add_task(calculate_commute_for_app, app_id)\n        return {\"message\": \"Application saved\", \"id\": app_id}"
    )

# 4. Patch update_application
if 'background_tasks: BackgroundTasks' not in content.split('def update_application(')[1].split('):')[0]:
    content = content.replace("async def update_application(app_id: int, request: ApplicationSaveRequest):", "async def update_application(app_id: int, request: ApplicationSaveRequest, background_tasks: BackgroundTasks):")
    content = content.replace(
        "return {\"message\": \"Application updated\", \"id\": app_id}",
        "if 'location' in request.dict(exclude_unset=True) or 'location_type' in request.dict(exclude_unset=True):\n                background_tasks.add_task(calculate_commute_for_app, app_id)\n            return {\"message\": \"Application updated\", \"id\": app_id}"
    )

with open('backend/main.py', 'w') as f:
    f.write(content)
print("done")
