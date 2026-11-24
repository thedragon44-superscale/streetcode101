import os
from dotenv import load_dotenv
import boto3
from botocore.client import Config

load_dotenv()

endpoint = os.getenv("AWS_ENDPOINT_URL")
key = os.getenv("AWS_ACCESS_KEY_ID")
secret = os.getenv("AWS_SECRET_ACCESS_KEY")
bucket = os.getenv("AWS_STORAGE_BUCKET_NAME")

print(f"Connecting to MinIO at {endpoint} with bucket '{bucket}'...")

s3 = boto3.client(
    's3',
    endpoint_url=endpoint,
    aws_access_key_id=key,
    aws_secret_access_key=secret,
    config=Config(signature_version='s3v4'),
    region_name='us-east-1'
)

try:
    response = s3.list_buckets()
    print("Successfully connected to MinIO!")
    print("Existing buckets:", [b['Name'] for b in response.get('Buckets', [])])
    
    # Check if dropship bucket exists, create if not
    bucket_names = [b['Name'] for b in response.get('Buckets', [])]
    if bucket not in bucket_names:
        print(f"Bucket '{bucket}' not found. Creating it now...")
        s3.create_bucket(Bucket=bucket)
        print(f"Bucket '{bucket}' created successfully!")
    else:
        print(f"Bucket '{bucket}' already exists and is accessible.")
        
except Exception as e:
    print("Failed to connect to MinIO:", e)
