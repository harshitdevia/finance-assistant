import subprocess
import time
import json
import urllib.request
import sys
import os

# Base URL of the Flask service
BASE_URL = 'http://127.0.0.1:5001'

def make_post_request(endpoint, payload):
    url = f"{BASE_URL}{endpoint}"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url, 
        data=data, 
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode('utf-8')
            return response.status, json.loads(res_data)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Connection failed for {endpoint}: {e}")
        return 500, {}

def run_tests():
    print("--- STARTING ML SERVICE INTEGRATION TESTS ---")
    
    # 1. Health Check
    print("Testing /health endpoint...")
    try:
        with urllib.request.urlopen(f"{BASE_URL}/health") as response:
            res = json.loads(response.read().decode('utf-8'))
            if response.status != 200 or res.get('status') != 'healthy':
                raise Exception("Health check failed")
            print("OK: Health check matches")
    except Exception as e:
        print(f"ERROR: Health check failed: {e}")
        return False

    # 2. Category Prediction
    print("Testing /predict/category endpoint...")
    cat_tests = [
        ("Swiggy food order delivery", "Food"),
        ("Google payment salary credit", "Salary"),
        ("Monthly rent flat lease", "Rent"),
        ("Wi-Fi broadband connection bill", "Utilities")
    ]
    for desc, expected in cat_tests:
        status, data = make_post_request('/predict/category', {"description": desc})
        if status != 200 or 'category' not in data:
            print(f"ERROR: Category prediction failed: {data}")
            return False
        print(f"OK: Classified '{desc}' -> '{data['category']}' (Expected: {expected})")

    # 3. Anomaly Detection
    print("Testing /predict/anomaly endpoint...")
    # Normal amounts: 100, 120, 150, 110, 130
    # Outlier amount: 2000
    anomaly_payload = {
        "past_amounts": [100, 120, 150, 110, 130, 140, 115],
        "current_amount": 2000
    }
    status, data = make_post_request('/predict/anomaly', anomaly_payload)
    if status != 200 or 'is_anomaly' not in data:
        print(f"ERROR: Anomaly detection failed: {data}")
        return False
    print(f"OK: Anomaly check: {anomaly_payload['current_amount']} flag = {data['is_anomaly']} (Expected: True)")
    
    # Normal check
    normal_payload = {
        "past_amounts": [100, 120, 150, 110, 130, 140, 115],
        "current_amount": 125
    }
    status, data = make_post_request('/predict/anomaly', normal_payload)
    print(f"OK: Anomaly check: {normal_payload['current_amount']} flag = {data['is_anomaly']} (Expected: False)")

    # 4. Expense Prediction
    print("Testing /predict/expense endpoint...")
    history_payload = {
        "monthly_history": [1000, 1200, 1400, 1600]
    }
    status, data = make_post_request('/predict/expense', history_payload)
    if status != 200 or 'predicted_expense' not in data:
        print(f"ERROR: Expense prediction failed: {data}")
        return False
    predicted = data['predicted_expense']
    print(f"OK: Spend history {history_payload['monthly_history']} -> Next month predicted spend: Rs.{predicted:.2f} (Expected: ~1800)")

    # 5. Chatbot Sandbox
    print("Testing /chatbot stub endpoint...")
    chatbot_payload = {
        "message": "Where is my money going?"
    }
    status, data = make_post_request('/chatbot', chatbot_payload)
    if status != 200 or 'reply' not in data:
        print(f"ERROR: Chatbot stub failed: {data}")
        return False
    print("OK: Chatbot response received successfully:")
    print(f"  Reply: {data['reply'][:120]}...")

    # 6. Portfolio Quotes
    print("Testing /portfolio/quote endpoint...")
    quote_payload = {
        "symbols": ["RELIANCE.NS", "AAPL", "119598"]
    }
    status, data = make_post_request('/portfolio/quote', quote_payload)
    if status != 200:
        print(f"ERROR: Portfolio quote failed: {data}")
        return False
    print("OK: Portfolio quotes received successfully:")
    for sym, res in data.items():
        print(f"  {sym}: success={res.get('success')}, price={res.get('price')}, name={res.get('name')}")

    # 7. Portfolio Search
    print("Testing /portfolio/search endpoint...")
    try:
        url = f"{BASE_URL}/portfolio/search?q=Reliance"
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode('utf-8')
            res = json.loads(res_data)
            if response.status != 200:
                raise Exception("Search endpoint failed")
            print(f"OK: Found {len(res)} search results for 'Reliance'")
            if res:
                print(f"  First result: {res[0]}")
    except Exception as e:
        print(f"ERROR: Portfolio search failed: {e}")
        return False

    print("-------------------------------------------")
    print("OK: ALL ML SERVICE INTEGRATION TESTS PASSED!")
    print("-------------------------------------------")
    return True

def start_server_and_run():
    python_path = os.path.join("venv", "Scripts", "python.exe")
    if not os.path.exists(python_path):
        python_path = "python"

    print("Starting Flask ML Service server...")
    # Disable flask reloader/debug and let logs output directly to the parent console
    test_env = {**os.environ, "PORT": "5001", "FLASK_DEBUG": "false"}
    server_process = subprocess.Popen(
        [python_path, "app.py"],
        env=test_env
    )
    
    # Wait for server to boot (give it 5 seconds)
    print("Waiting 5 seconds for server to start...")
    time.sleep(5)
    
    # Check if process is still running
    if server_process.poll() is not None:
        print("ERROR: Flask server failed to start.")
        sys.exit(1)

    try:
        success = run_tests()
    except Exception as ex:
        print(f"ERROR during test execution: {ex}")
        success = False
    finally:
        print("Stopping Flask ML Service server...")
        server_process.terminate()
        server_process.wait()
        
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    start_server_and_run()
