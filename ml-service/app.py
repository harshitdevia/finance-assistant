from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import certifi
import numpy as np
# Set environment variables for CA certificates to avoid curl SSL certificate location error on Windows
os.environ['SSL_CERT_FILE'] = certifi.where()
os.environ['CURL_CA_BUNDLE'] = certifi.where()

from dotenv import load_dotenv
import yfinance as yf
import requests

# Load models functions
from models import (
    predict_next_month_spend,
    detect_anomaly,
    predict_transaction_category
)
from chatbot import generate_chatbot_reply

# Load env variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Health Check Route
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "message": "WealthAI Machine Learning Service is running"
    })

# 1. Endpoint for Auto-categorization
@app.route('/predict/category', methods=['POST'])
def get_category():
    data = request.get_json()
    if not data or 'description' not in data:
        return jsonify({"error": "Description is required"}), 400
        
    description = data['description']
    category = predict_transaction_category(description)
    return jsonify({
        "description": description,
        "category": category
    })

# 2. Endpoint for Anomaly Detection
@app.route('/predict/anomaly', methods=['POST'])
def get_anomaly():
    data = request.get_json()
    if not data or 'current_amount' not in data or 'past_amounts' not in data:
        return jsonify({"error": "current_amount and past_amounts (list) are required"}), 400

    if not isinstance(data['past_amounts'], list):
        return jsonify({"error": "past_amounts must be a list of numbers"}), 400

    try:
        current_amount = float(data['current_amount'])
        past_amounts = [float(x) for x in data['past_amounts']]
    except (TypeError, ValueError):
        return jsonify({"error": "current_amount and past_amounts must be numeric"}), 400

    is_anomaly = detect_anomaly(past_amounts, current_amount)
    return jsonify({
        "current_amount": current_amount,
        "is_anomaly": is_anomaly
    })

# 3. Endpoint for Expense Prediction
@app.route('/predict/expense', methods=['POST'])
def get_expense_prediction():
    data = request.get_json()
    if not data or 'monthly_history' not in data:
        return jsonify({"error": "monthly_history (list) is required"}), 400

    if not isinstance(data['monthly_history'], list):
        return jsonify({"error": "monthly_history must be a list of numbers"}), 400

    try:
        monthly_history = [float(x) for x in data['monthly_history']]
    except (TypeError, ValueError):
        return jsonify({"error": "monthly_history must contain only numbers"}), 400

    predicted_val = predict_next_month_spend(monthly_history)
    
    return jsonify({
        "predicted_expense": predicted_val
    })

# 4. Chatbot Endpoint (integrated with Anthropic Claude and Mock fallback)
@app.route('/chatbot', methods=['POST'])
def run_chatbot():
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({"error": "message is required"}), 400
        
    user_message = data['message']
    context = data.get('context', {})
    conversation_history = data.get('conversation_history', [])  # Memory window
    
    reply = generate_chatbot_reply(user_message, context, conversation_history)
    
    return jsonify({
        "reply": reply
    })


# Helper function to fetch yfinance quotes
def fetch_yfinance_quotes(symbols):
    results = {}
    if not symbols:
        return results
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            price = None
            prev_close = None
            
            # Fetch 2 days of history to get current price and yesterday's close robustly
            hist = ticker.history(period='2d')
            if not hist.empty and len(hist) >= 1:
                price = hist['Close'].iloc[-1]
                if len(hist) >= 2:
                    prev_close = hist['Close'].iloc[-2]
                else:
                    try:
                        prev_close = ticker.fast_info.get('previous_close')
                    except Exception:
                        pass
            else:
                try:
                    price = ticker.fast_info.get('last_price')
                    prev_close = ticker.fast_info.get('previous_close')
                except Exception:
                    pass
            
            # Calculate change
            change = 0.0
            change_pct = 0.0
            if price is not None:
                if prev_close is not None and prev_close > 0:
                    change = price - prev_close
                    change_pct = (change / prev_close) * 100
                
                # Fetch name
                name = symbol
                try:
                    name = ticker.info.get('longName', symbol)
                except Exception:
                    pass
                
                results[symbol] = {
                    "price": float(price),
                    "change": float(change),
                    "changePercent": float(change_pct),
                    "name": name,
                    "success": True
                }
            else:
                results[symbol] = {"success": False, "error": "Price not found"}
        except Exception as e:
            results[symbol] = {"success": False, "error": str(e)}
    return results

# Helper function to fetch AMFI mutual fund NAVs
def fetch_amfi_nav(code):
    try:
        url = f"https://api.mfapi.in/mf/{code}"
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            meta = data.get('meta', {})
            name = meta.get('scheme_name', f"Mutual Fund {code}")
            nav_list = data.get('data', [])
            if nav_list:
                current_nav = float(nav_list[0].get('nav'))
                change = 0.0
                change_pct = 0.0
                if len(nav_list) > 1:
                    prev_nav = float(nav_list[1].get('nav'))
                    if prev_nav > 0:
                        change = current_nav - prev_nav
                        change_pct = (change / prev_nav) * 100
                return {
                    "price": current_nav,
                    "change": change,
                    "changePercent": change_pct,
                    "name": name,
                    "success": True
                }
        return {"success": False, "error": f"Failed to fetch NAV for {code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# 5. Endpoint for batch quotes
@app.route('/portfolio/quote', methods=['POST'])
def get_portfolio_quotes():
    data = request.get_json()
    if not data or 'symbols' not in data:
        return jsonify({"error": "symbols (list) is required"}), 400

    if not isinstance(data['symbols'], list):
        return jsonify({"error": "symbols must be a list"}), 400

    symbols = data['symbols']
    results = {}
    
    yf_symbols = []
    amfi_codes = []
    
    for sym in symbols:
        sym_str = str(sym).strip()
        if sym_str.isdigit():
            amfi_codes.append(sym_str)
        else:
            yf_symbols.append(sym_str)
            
    if yf_symbols:
        results.update(fetch_yfinance_quotes(yf_symbols))
        
    for code in amfi_codes:
        results[code] = fetch_amfi_nav(code)
        
    return jsonify(results)

# 6. Endpoint for searching assets
@app.route('/portfolio/search', methods=['GET'])
def search_symbols():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    
    results = []
    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            quotes = resp.json().get('quotes', [])
            for q in quotes:
                symbol = q.get('symbol')
                name = q.get('shortname') or q.get('longname') or symbol
                quote_type = q.get('quoteType', '')
                exchange = q.get('exchange', '')
                
                if quote_type in ['EQUITY', 'MUTUALFUND', 'ETF', 'INDEX']:
                    results.append({
                        "symbol": symbol,
                        "name": name,
                        "type": quote_type.lower(),
                        "exchange": exchange
                    })
    except Exception as e:
        print(f"Yahoo Search error: {e}")
        
    return jsonify(results)

# 7. Endpoint for Portfolio Robo-Advisor Analysis
@app.route('/portfolio/analyze', methods=['POST'])
def analyze_portfolio():
    data = request.get_json() or {}
    holdings = data.get('holdings', [])
    risk_profile = data.get('riskProfile', 'balanced').lower()

    if not isinstance(holdings, list):
        return jsonify({"error": "holdings must be a list"}), 400

    total_val = 0.0
    equity_val = 0.0
    gold_val = 0.0
    debt_val = 0.0

    for h in holdings:
        if not isinstance(h, dict):
            continue
        try:
            val = float(h.get('currentValue', 0.0))
        except (TypeError, ValueError):
            val = 0.0
        total_val += val
        asset_type = h.get('assetType', 'stock')
        if asset_type in ['stock', 'mutual_fund']:
            equity_val += val
        elif asset_type == 'gold':
            gold_val += val
        elif asset_type == 'fd':
            debt_val += val
            
    # Default fallback total
    if total_val == 0.0:
        return jsonify({
            "riskScore": 0,
            "actualAllocation": {"equity": 0, "gold": 0, "debt": 0},
            "targetAllocation": {"equity": 60, "gold": 15, "debt": 25},
            "recommendations": ["Add assets to your portfolio to receive AI asset rebalancing recommendations."]
        })
        
    actual_equity_pct = (equity_val / total_val) * 100
    actual_gold_pct = (gold_val / total_val) * 100
    actual_debt_pct = (debt_val / total_val) * 100
    
    # Target ratios
    targets = {
        'conservative': {'equity': 30.0, 'debt': 50.0, 'gold': 20.0},
        'balanced': {'equity': 60.0, 'debt': 25.0, 'gold': 15.0},
        'aggressive': {'equity': 80.0, 'debt': 10.0, 'gold': 10.0}
    }
    
    profile_target = targets.get(risk_profile, targets['balanced'])
    
    # Deviation values (Target value - Actual value)
    equity_target_val = total_val * (profile_target['equity'] / 100.0)
    debt_target_val = total_val * (profile_target['debt'] / 100.0)
    gold_target_val = total_val * (profile_target['gold'] / 100.0)
    
    equity_dev = equity_target_val - equity_val
    debt_dev = debt_target_val - debt_val
    gold_dev = gold_target_val - gold_val
    
    # Risk Score: Equity represents primary risk, so scale it directly
    risk_score = min(max(int(actual_equity_pct), 0), 100)
    
    recommendations = []
    
    # Analyze deviations
    dev_threshold = 5.0  # 5% threshold
    rebalance_needed = False
    
    if abs(actual_equity_pct - profile_target['equity']) > dev_threshold:
        rebalance_needed = True
        if equity_dev < 0:
            recommendations.append(
                f"Equity is OVER-allocated by {abs(actual_equity_pct - profile_target['equity']):.1f}% (₹{abs(equity_dev):,.0f} surplus). "
                f"Aurelia recommends selling a portion of equity assets to lock in gains."
            )
        else:
            recommendations.append(
                f"Equity is UNDER-allocated by {abs(actual_equity_pct - profile_target['equity']):.1f}% (₹{abs(equity_dev):,.0f} deficit). "
                f"Consider deploying surplus capital into stocks or equity mutual funds."
            )
            
    if abs(actual_debt_pct - profile_target['debt']) > dev_threshold:
        rebalance_needed = True
        if debt_dev < 0:
            recommendations.append(
                f"Debt/FDs are OVER-allocated by {abs(actual_debt_pct - profile_target['debt']):.1f}% (₹{abs(debt_dev):,.0f} surplus). "
                f"Consider transferring capital to gold or equities for better compound growth."
            )
        else:
            recommendations.append(
                f"Debt/FDs are UNDER-allocated by {abs(actual_debt_pct - profile_target['debt']):.1f}% (₹{abs(debt_dev):,.0f} deficit). "
                f"Aurelia recommends increasing fixed deposits to lock in stable yields and buffer volatility."
            )
            
    if abs(actual_gold_pct - profile_target['gold']) > dev_threshold:
        rebalance_needed = True
        if gold_dev < 0:
            recommendations.append(
                f"Gold is OVER-allocated by {abs(actual_gold_pct - profile_target['gold']):.1f}% (₹{abs(gold_dev):,.0f} surplus). "
                f"You can reallocate gold profits into other underweight assets."
            )
        else:
            recommendations.append(
                f"Gold is UNDER-allocated by {abs(actual_gold_pct - profile_target['gold']):.1f}% (₹{abs(gold_dev):,.0f} deficit). "
                f"Aurelia recommends purchasing Gold ETFs to hedge your portfolio against market inflation."
            )
            
    if not rebalance_needed:
        recommendations.append(
            f"Superb! Your portfolio is perfectly aligned with the target allocation of the '{risk_profile}' profile "
            f"(deviations are within safe 5% limits). No immediate rebalancing is required."
        )
    else:
        recommendations.append(
            "Rebalancing action is recommended. Perform adjustments in small tranches to avoid transaction overhead."
        )
        
    return jsonify({
        "riskScore": risk_score,
        "actualAllocation": {
            "equity": round(actual_equity_pct, 1),
            "gold": round(actual_gold_pct, 1),
            "debt": round(actual_debt_pct, 1)
        },
        "targetAllocation": {
            "equity": profile_target['equity'],
            "gold": profile_target['gold'],
            "debt": profile_target['debt']
        },
        "recommendations": recommendations
    })

# 8. Endpoint for Monte Carlo Portfolio Projections Simulation
@app.route('/portfolio/simulate', methods=['POST'])
def simulate_projections():
    data = request.get_json() or {}
    try:
        current_net_worth = float(data.get('current_net_worth', 0.0))
        monthly_savings = float(data.get('monthly_savings', 0.0))
        years = int(data.get('years', 10))
    except (TypeError, ValueError):
        return jsonify({"error": "current_net_worth, monthly_savings and years must be numeric"}), 400

    if years < 1 or years > 50:
        return jsonify({"error": "years must be between 1 and 50"}), 400

    risk_profile = str(data.get('risk_profile', 'balanced')).lower()
    
    # Select mean and std_dev based on risk profile
    if risk_profile == 'conservative':
        mean = 0.07
        std_dev = 0.03
    elif risk_profile == 'aggressive':
        mean = 0.15
        std_dev = 0.14
    else: # balanced
        mean = 0.11
        std_dev = 0.08
        
    num_trials = 1000
    
    # trials matrix: shape (num_trials, years + 1)
    trials = np.zeros((num_trials, years + 1))
    trials[:, 0] = current_net_worth
    
    for year in range(1, years + 1):
        yields = np.random.normal(mean, std_dev, num_trials)
        # Compound previous year's wealth and add annual savings
        trials[:, year] = np.maximum(0.0, trials[:, year - 1] * (1 + yields) + (monthly_savings * 12))
        
    response_data = []
    for year in range(years + 1):
        year_data = trials[:, year]
        p10 = float(np.percentile(year_data, 10))
        p50 = float(np.percentile(year_data, 50))
        p90 = float(np.percentile(year_data, 90))
        response_data.append({
            "year": year,
            "p10": round(p10, 2),
            "p50": round(p50, 2),
            "p90": round(p90, 2)
        })
        
    return jsonify({
        "risk_profile": risk_profile,
        "mean": mean,
        "std_dev": std_dev,
        "projections": response_data
    })

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug_mode, threaded=True)
