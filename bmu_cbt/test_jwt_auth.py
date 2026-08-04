#!/usr/bin/env python
"""
Test script for JWT authentication and admin-only endpoints
"""
import os
import sys
import json
import requests
from datetime import datetime, timedelta

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Base URL for the API
BASE_URL = "http://127.0.0.1:8000/api"

def test_jwt_authentication():
    """Test JWT login and token usage"""
    print("🔐 Testing JWT Authentication...")
    
    # Test login
    login_data = {
        "username": "BMU-0519",  # Our superuser
        "password": "admin123"
    }
    
    try:
        # Login to get tokens
        response = requests.post(f"{BASE_URL}/auth/login/", json=login_data)
        
        if response.status_code == 200:
            tokens = response.json()
            access_token = tokens.get('access')
            refresh_token = tokens.get('refresh')
            
            print(f"✅ Login successful! User: {tokens.get('username')}")
            print(f"📝 Access token received: {access_token[:50]}...")
            
            # Test accessing protected endpoint with token
            headers = {"Authorization": f"Bearer {access_token}"}
            
            # Test profile endpoint
            profile_response = requests.get(f"{BASE_URL}/auth/profile/", headers=headers)
            
            if profile_response.status_code == 200:
                profile = profile_response.json()
                print(f"✅ Profile access successful! User: {profile.get('username')}")
                print(f"👤 User Type: {profile.get('user_type')}")
                print(f"🔑 Is Superuser: {profile.get('is_superuser', 'N/A')}")
            else:
                print(f"❌ Profile access failed: {profile_response.status_code}")
                print(f"Response: {profile_response.text}")
            
            return access_token, refresh_token
            
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None, None
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure the development server is running.")
        return None, None
    except Exception as e:
        print(f"❌ Error during authentication test: {e}")
        return None, None

def test_admin_only_endpoint(access_token):
    """Test admin-only POST /exams/ endpoint"""
    print("\n🔒 Testing Admin-Only Endpoint...")
    
    if not access_token:
        print("❌ No access token available for testing")
        return
    
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Test data for creating an exam
    exam_data = {
        "title": "Test Exam - JWT Auth",
        "category_id": 1,  # Assuming category with ID 1 exists
        "description": "Test exam created via API",
        "instructions": "Follow all instructions carefully",
        "duration_minutes": 60,
        "passing_score": 70,
        "start_date": (datetime.now() + timedelta(days=1)).isoformat(),
        "end_date": (datetime.now() + timedelta(days=7)).isoformat(),
        "show_answers": True,
        "show_score": True,
        "shuffle_questions": False,
        "shuffle_options": False,
        "allow_review": True
    }
    
    try:
        # Test creating exam (should work for admin)
        response = requests.post(f"{BASE_URL}/exams/", json=exam_data, headers=headers)
        
        if response.status_code == 200:
            exam = response.json()
            print(f"✅ Exam creation successful! Exam ID: {exam.get('id')}")
            print(f"📋 Title: {exam.get('title')}")
            print(f"📚 Category: {exam.get('category', {}).get('name', 'N/A')}")
        elif response.status_code == 403:
            print("❌ Access denied - user is not an admin")
            print(f"Response: {response.text}")
        elif response.status_code == 400:
            print("⚠️ Bad request - possibly invalid category or data")
            print(f"Response: {response.text}")
        else:
            print(f"❌ Exam creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error during admin endpoint test: {e}")

def test_unauthorized_access():
    """Test accessing endpoints without authentication"""
    print("\n🚫 Testing Unauthorized Access...")
    
    try:
        # Test accessing exams without token
        response = requests.get(f"{BASE_URL}/exams/")
        
        if response.status_code == 401:
            print("✅ Properly rejects unauthorized access")
        elif response.status_code == 200:
            print("⚠️ Exams endpoint allows public access (may be intended)")
        else:
            print(f"❓ Unexpected response: {response.status_code}")
            
        # Test creating exam without token (should fail)
        exam_data = {"title": "Unauthorized Test"}
        response = requests.post(f"{BASE_URL}/exams/", json=exam_data)
        
        if response.status_code == 401:
            print("✅ Admin endpoint properly rejects unauthorized access")
        else:
            print(f"❌ Admin endpoint should reject unauthorized access. Got: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error during unauthorized access test: {e}")

def main():
    """Run all tests"""
    print("🚀 Starting JWT Authentication Tests")
    print("=" * 50)
    
    # Test authentication
    access_token, refresh_token = test_jwt_authentication()
    
    # Test admin-only endpoint
    test_admin_only_endpoint(access_token)
    
    # Test unauthorized access
    test_unauthorized_access()
    
    print("\n" + "=" * 50)
    print("🏁 JWT Authentication Tests Complete")

if __name__ == "__main__":
    main()
