#!/usr/bin/env python
"""
Download CSV exports from the BMU CBT API
"""
import requests
import os
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000/api"

def get_auth_token():
    """Get JWT authentication token"""
    login_data = {
        "username": "BMU-0519",
        "password": "admin123"
    }
    
    response = requests.post(f"{BASE_URL}/auth/login/", json=login_data)
    
    if response.status_code == 200:
        return response.json().get('access')
    else:
        print(f"❌ Login failed: {response.status_code}")
        return None

def download_csv(url, filename, headers):
    """Download CSV file from URL"""
    print(f"📥 Downloading {filename}...")
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        # Save to file
        with open(filename, 'wb') as f:
            f.write(response.content)
        
        print(f"✅ Saved: {filename} ({len(response.content)} bytes)")
        return True
    else:
        print(f"❌ Download failed: {response.status_code}")
        print(f"Response: {response.text}")
        return False

def main():
    """Main download function"""
    print("🚀 BMU CBT CSV Export Downloader")
    print("=" * 40)
    
    # Get auth token
    token = get_auth_token()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create downloads directory
    os.makedirs("exports", exist_ok=True)
    
    # Download exam results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    exam_results_file = f"exports/exam_results_{timestamp}.csv"
    download_csv(
        f"{BASE_URL}/results/export/exam-results/",
        exam_results_file,
        headers
    )
    
    # Download student performance
    student_perf_file = f"exports/student_performance_{timestamp}.csv"
    download_csv(
        f"{BASE_URL}/results/export/student-performance/",
        student_perf_file,
        headers
    )
    
    print(f"\n📁 Files saved in 'exports' directory")
    print(f"🌐 You can also access via: http://127.0.0.1:8000/api/docs")

if __name__ == "__main__":
    main()
