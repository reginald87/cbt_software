#!/usr/bin/env python
"""
Test script for exam results export functionality
"""
import requests
import json

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
        print(f"Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None

def test_export_endpoints():
    """Test the export endpoints"""
    print("🧪 Testing Export Endpoints...")
    
    # Get auth token
    token = get_auth_token()
    if not token:
        print("❌ Cannot get auth token")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Export all exam results
    print("\n📊 Testing export all exam results...")
    response = requests.get(f"{BASE_URL}/results/export/exam-results/", headers=headers)
    
    if response.status_code == 200:
        print("✅ Export successful!")
        print(f"Content-Type: {response.headers.get('Content-Type')}")
        print(f"Content-Disposition: {response.headers.get('Content-Disposition')}")
        print(f"Response size: {len(response.content)} bytes")
        # Show first few lines of CSV
        lines = response.text.split('\n')[:5]
        print("First few lines of CSV:")
        for i, line in enumerate(lines):
            print(f"  {i+1}: {line}")
    else:
        print(f"❌ Export failed: {response.status_code}")
        print(f"Response: {response.text}")
    
    # Test 2: Export student performance
    print("\n📈 Testing export student performance...")
    response = requests.get(f"{BASE_URL}/results/export/student-performance/", headers=headers)
    
    if response.status_code == 200:
        print("✅ Student performance export successful!")
        print(f"Content-Type: {response.headers.get('Content-Type')}")
        print(f"Content-Disposition: {response.headers.get('Content-Disposition')}")
        print(f"Response size: {len(response.content)} bytes")
    else:
        print(f"❌ Student performance export failed: {response.status_code}")
        print(f"Response: {response.text}")
    
    # Test 3: Get all attempts (admin)
    print("\n📋 Testing get all attempts...")
    response = requests.get(f"{BASE_URL}/results/admin/attempts/", headers=headers)
    
    if response.status_code == 200:
        attempts = response.json()
        print(f"✅ Retrieved {len(attempts)} attempts")
        if attempts:
            print("First attempt:")
            print(f"  Exam: {attempts[0].get('exam_title')}")
            print(f"  Status: {attempts[0].get('status')}")
            print(f"  Grade: {attempts[0].get('grade')}")
    else:
        print(f"❌ Get attempts failed: {response.status_code}")
        print(f"Response: {response.text}")

if __name__ == "__main__":
    test_export_endpoints()
