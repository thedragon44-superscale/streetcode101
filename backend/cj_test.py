import requests
import os
import json
from dotenv import load_dotenv

# Load your API key
load_dotenv()
cj_api_key = os.getenv("CJ_API_KEY")

print("1. Authenticating with CJ...")
auth_url = "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken"
auth_res = requests.post(auth_url, json={"apiKey": cj_api_key}, headers={"User-Agent": "Mozilla/5.0"})
token = auth_res.json().get("data", {}).get("accessToken")

print("2. Pinging Deep Query API for CJPB2083...")
url = "https://developers.cjdropshipping.com/api2.0/v1/product/query"
res = requests.get(
    url, 
    params={"productSku": "CJPB2083"}, 
    headers={"CJ-Access-Token": token, "User-Agent": "Mozilla/5.0"}
)

print("\n--- RAW CJ API RESPONSE ---")
data = res.json()

# Print the keys so we don't flood your terminal with a massive wall of text
if "data" in data and data["data"]:
    print(f"Product Name: {data['data'].get('productNameEn')}")
    print(f"Variant Array Found? {'variantList' in data['data']}")
    if 'variantList' in data['data']:
        print(f"Number of Variants: {len(data['data']['variantList'])}")
    else:
        print("CJ did NOT send a 'variantList'. Here are the keys they DID send:")
        print(list(data['data'].keys()))
else:
    print(json.dumps(data, indent=2))
