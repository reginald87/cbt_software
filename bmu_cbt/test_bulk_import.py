#!/usr/bin/env python
"""
Test script for bulk import functionality
"""
import requests
import os

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
        print(f"Response: {response.text}")
        return None

def test_bulk_import():
    """Test bulk import functionality"""
    print("🧪 Testing Bulk Import Functionality...")
    
    # Get auth token
    token = get_auth_token()
    if not token:
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Download exam template
    print("\n📄 Testing exam template download...")
    response = requests.get(f"{BASE_URL}/exams/bulk/templates/exams/", headers=headers)
    
    if response.status_code == 200:
        print("✅ Exam template downloaded successfully!")
        with open("exam_template.csv", "wb") as f:
            f.write(response.content)
        print("📁 Saved as: exam_template.csv")
    else:
        print(f"❌ Template download failed: {response.status_code}")
        print(f"Response: {response.text}")
    
    # Test 2: Download questions template
    print("\n📄 Testing questions template download...")
    response = requests.get(f"{BASE_URL}/exams/bulk/templates/questions/", headers=headers)
    
    if response.status_code == 200:
        print("✅ Questions template downloaded successfully!")
        with open("questions_template.csv", "wb") as f:
            f.write(response.content)
        print("📁 Saved as: questions_template.csv")
    else:
        print(f"❌ Questions template download failed: {response.status_code}")
        print(f"Response: {response.text}")
    
    # Test 3: Import sample exams
    print("\n📤 Testing exam import...")
    if os.path.exists("sample_exams.csv"):
        with open("sample_exams.csv", "rb") as f:
            files = {"csv_file": f}
            response = requests.post(f"{BASE_URL}/exams/bulk/import/exams/", headers=headers, files=files)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Exam import successful!")
            print(f"📊 Imported: {result.get('imported', 0)} exams")
            if result.get('errors'):
                print(f"⚠️  Errors: {len(result['errors'])}")
                for error in result['errors'][:3]:  # Show first 3 errors
                    print(f"   - {error}")
        else:
            print(f"❌ Exam import failed: {response.status_code}")
            print(f"Response: {response.text}")
    else:
        print("⚠️  sample_exams.csv not found")
    
    # Test 4: Import sample questions
    print("\n📤 Testing questions import...")
    if os.path.exists("sample_questions.csv"):
        with open("sample_questions.csv", "rb") as f:
            files = {"csv_file": f}
            response = requests.post(f"{BASE_URL}/exams/bulk/import/questions/", headers=headers, files=files)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Questions import successful!")
            print(f"📊 Imported: {result.get('imported', 0)} questions")
            if result.get('errors'):
                print(f"⚠️  Errors: {len(result['errors'])}")
                for error in result['errors'][:3]:  # Show first 3 errors
                    print(f"   - {error}")
        else:
            print(f"❌ Questions import failed: {response.status_code}")
            print(f"Response: {response.text}")
    else:
        print("⚠️  sample_questions.csv not found")
    
    print("\n🎉 Bulk import testing complete!")

if __name__ == "__main__":
    test_bulk_import()
