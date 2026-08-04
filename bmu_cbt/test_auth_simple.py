#!/usr/bin/env python
"""
Simple test for auth endpoint
"""
import requests

def test_login():
    """Test login endpoint"""
    login_data = {
        "username": "BMU-0519",
        "password": "admin123"
    }
    
    try:
        response = requests.post("http://127.0.0.1:8000/api/auth/login/", json=login_data)
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Response Text: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Access Token: {data.get('access', 'N/A')[:50]}...")
            return data.get('access')
        else:
            print("Login failed")
            return None
            
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    test_login()
