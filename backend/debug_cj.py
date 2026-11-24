import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
cj_api_key = os.getenv("CJ_API_KEY")

print("1. Authenticating...")
auth_url = "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken"
token = requests.post(auth_url, json={"apiKey": cj_api_key}, headers={"User-Agent": "Mozilla/5.0"}).json()["data"]["accessToken"]

print("2. Pinging Deep Query API for the Shoes (ID: 1812478869711507456)...")
query_url = "https://developers.cjdropshipping.com/api2.0/v1/product/query"
res = requests.get(query_url, headers={"CJ-Access-Token": token, "User-Agent": "Mozilla/5.0"}, params={"pid": "1812478869711507456"})

data = res.json().get("data", {})

print("\n✅ Keys found in Deep Query response:")
print(list(data.keys()))

for key, value in data.items():
    if isinstance(value, list) and len(value) > 0:
        print(f"\n--- ARRAY FOUND: '{key}' (Contains {len(value)} items) ---")
        print("First item in this array looks like this:")
        print(json.dumps(value[0], indent=2))
