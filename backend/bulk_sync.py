import os
import requests
import time
from dotenv import load_dotenv
from sqlmodel import Session, select
from database import engine
from models import Product

# Load env variables
load_dotenv()
cj_api_key = os.getenv("CJ_API_KEY")

def run_bulk_sync():
    print("--- STARTING FINAL DEEP VARIANT SYNC ---")
    
    auth_url = "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken"
    auth_res = requests.post(auth_url, json={"apiKey": cj_api_key}, headers={"User-Agent": "Mozilla/5.0"})
    
    if not auth_res.ok or not auth_res.json().get("data"):
        print("❌ CRITICAL ERROR: Failed to authenticate with CJ.")
        return
        
    access_token = auth_res.json()["data"].get("accessToken")
    auth_headers = {"User-Agent": "Mozilla/5.0", "CJ-Access-Token": access_token}

    with Session(engine) as session:
        products = session.exec(select(Product)).all()
        print(f"2. Found {len(products)} products in database. Querying variants...")
        
        updated = 0
        
        for idx, prod in enumerate(products, 1):
            if not prod.supplier_sku:
                continue
                
            print(f"\n[{idx}/{len(products)}] Processing {prod.supplier_sku}...")
            
            try:
                # STEP 1: Search listV2 to grab the 'id'
                search_url = "https://developers.cjdropshipping.com/api2.0/v1/product/listV2"
                search_res = requests.get(search_url, headers=auth_headers, params={"page": 1, "size": 1, "keyWord": prod.supplier_sku}, timeout=15)
                content_list = search_res.json().get("data", {}).get("content", [])
                
                if not content_list or not content_list[0].get("productList"):
                    print(f"  ↳ ⚠️ Not found in listV2 search. Skipping.")
                    continue
                    
                actual_pid = content_list[0].get("productList")[0].get("id")
                
                if not actual_pid:
                    print(f"  ↳ ⚠️ No 'id' found. Skipping.")
                    continue
                    
                # STEP 2: Use 'id' for Deep Query
                query_url = "https://developers.cjdropshipping.com/api2.0/v1/product/query"
                query_res = requests.get(query_url, headers=auth_headers, params={"pid": actual_pid}, timeout=15)
                p = query_res.json().get("data")
                
                if not p:
                    print(f"  ↳ ⚠️ Deep Query returned empty. Skipping.")
                    continue
                    
                base_price = float(p.get("sellPrice", 15.00))
                # THE FIX: Target the correct 'variants' array and 'variantSellPrice'
                cj_variants = p.get("variants", [])
                parsed_variants = []
                
                for v in cj_variants:
                    v_key = v.get("variantKey", "Default")
                    parts = v_key.split("-")
                    color = parts[0] if len(parts) > 0 else "Default"
                    size = parts[-1] if len(parts) > 1 else "OS"
                    
                    img_url = v.get("variantImage")
                    if not img_url:
                        img_url = prod.image_url 
                        
                    parsed_variants.append({
                        "variant_sku": v.get("variantSku", ""),
                        "color": color,
                        "size": size,
                        "price": float(v.get("variantSellPrice", base_price)) * 2.5,
                        "image_url": img_url
                    })
                    
                if not parsed_variants:
                    parsed_variants = [{"variant_sku": f"101-{prod.supplier_sku[:8]}-DEF", "color": "Default", "size": "OS", "price": base_price * 2.5, "image_url": prod.image_url}]
                    
                prod.variants = parsed_variants
                session.add(prod)
                updated += 1
                print(f"  ↳ ✅ Success! Saved {len(parsed_variants)} variants (e.g. {parsed_variants[0]['color']} / {parsed_variants[0]['size']}).")
                
                time.sleep(1)
                
            except Exception as e:
                print(f"  ↳ ❌ Error processing {prod.supplier_sku}: {e}")
                continue
                
        session.commit()
        print(f"\n--- SYNC COMPLETE: {updated} products updated successfully! ---")

if __name__ == "__main__":
    run_bulk_sync()
