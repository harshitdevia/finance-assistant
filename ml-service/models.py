import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline

# ----------------------------------------------------
# 1. CATEGORY SPEND FORECASTING (Linear Regression)
# ----------------------------------------------------
def predict_next_month_spend(monthly_history):
    """
    Predicts next month's spending for a category using Linear Regression.
    monthly_history: List of spends sorted by month chronologically, e.g. [1500, 1800, 1600]
    """
    n_months = len(monthly_history)
    
    # If not enough history points to compute trend, fallback to average
    if n_months < 2:
        return float(np.mean(monthly_history)) if n_months == 1 else 0.0

    # X = Month indices [1, 2, 3, ...], y = Monthly spends
    X = np.array(range(1, n_months + 1)).reshape(-1, 1)
    y = np.array(monthly_history)

    model = LinearRegression()
    model.fit(X, y)

    # Predict for the next month index (n_months + 1)
    next_month = np.array([[n_months + 1]])
    predicted_val = model.predict(next_month)[0]

    # Don't return negative expense forecasts
    return max(0.0, float(predicted_val))


# ----------------------------------------------------
# 2. TRANSACTION ANOMALY DETECTION (Isolation Forest)
# ----------------------------------------------------
def detect_anomaly(past_amounts, current_amount):
    """
    Detects if a new transaction amount is anomalous relative to past history.
    past_amounts: List of float amounts of past category transactions.
    current_amount: The float amount of the new transaction.
    """
    # Fallback to statistical Z-score if there is not enough history to fit Isolation Forest
    if len(past_amounts) < 15:
        if not past_amounts:
            return False
        
        mean = np.mean(past_amounts)
        std = np.std(past_amounts)
        
        if std == 0:
            # If standard deviation is 0 (all previous transactions were identical),
            # flag as anomaly if the new amount deviates by more than 50%
            return bool(current_amount > mean * 1.5)
            
        z_score = (current_amount - mean) / std
        # Flag if transaction is more than 3 standard deviations above the average
        return bool(z_score > 3.0)

    # Fit Isolation Forest
    X_train = np.array(past_amounts).reshape(-1, 1)
    
    # Train Isolation Forest (contamination rate set to e.g. 5% typical outliers)
    clf = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    clf.fit(X_train)

    X_test = np.array([[current_amount]])
    prediction = clf.predict(X_test)[0] # Returns 1 for normal, -1 for anomaly

    return bool(prediction == -1)


# ----------------------------------------------------
# 3. AUTO-CATEGORIZATION (Tfidf + Multinomial Naive Bayes)
# ----------------------------------------------------
# Labeled synthetic corpus for training
training_data = [
    # Salary
    ('Google salary credit', 'Salary'),
    ('Salary payout June', 'Salary'),
    ('Stipend internship transfer', 'Salary'),
    ('Monthly paycheck direct deposit', 'Salary'),
    ('Compensation payroll', 'Salary'),
    
    # Freelance
    ('Upwork contract payment', 'Freelance'),
    ('Fiverr logo project payout', 'Freelance'),
    ('Freelance website coding fee', 'Freelance'),
    ('Client invoice payment', 'Freelance'),
    
    # Rent
    ('Apartment flat rent', 'Rent'),
    ('House monthly lease payment', 'Rent'),
    ('PG rental fee', 'Rent'),
    ('Rent transfer to landlord', 'Rent'),
    
    # Food & Dining
    ('Starbucks coffee macchiato', 'Food'),
    ('Dominos Pizza burger dinner', 'Food'),
    ('Swiggy online food order delivery', 'Food'),
    ('Zomato restaurant dine out lunch', 'Food'),
    ('Cafe breakfast tea', 'Food'),
    
    # Groceries
    ('Supermarket grocery shopping', 'Groceries'),
    ('Local market vegetables fruits', 'Groceries'),
    ('Milk bread eggs provision store', 'Groceries'),
    ('BigBasket monthly groceries delivery', 'Groceries'),
    
    # Utilities
    ('Electricity bill payment power grid', 'Utilities'),
    ('Water utility bill invoice', 'Utilities'),
    ('Wi-Fi broadband connection broadband', 'Utilities'),
    ('Mobile phone recharge postpaid bill', 'Utilities'),
    
    # Entertainment
    ('Netflix monthly subscription', 'Entertainment'),
    ('Spotify music premium payment', 'Entertainment'),
    ('BookMyShow movie ticket cinema', 'Entertainment'),
    ('Steam gaming purchase store', 'Entertainment'),
    
    # Transport
    ('Uber cab ride transfer', 'Transport'),
    ('Ola taxi fare ride', 'Transport'),
    ('Petrol diesel gas station refill', 'Transport'),
    ('Metro rail train smart card recharge', 'Transport'),
    
    # Shopping
    ('Amazon online shopping delivery', 'Shopping'),
    ('Zara apparel clothing buy shirt', 'Shopping'),
    ('Flipkart clothes purchase shoes', 'Shopping'),
    ('Mall retail brand store purchase', 'Shopping'),
    
    # Healthcare
    ('Pharmacy medicine drugs purchase', 'Healthcare'),
    ('Dentist checkup clinic fee', 'Healthcare'),
    ('Hospital doctor consultation charge', 'Healthcare'),
    ('Medical diagnostic test blood report', 'Healthcare'),
    
    # Default Others
    ('Transfer to friend', 'Others'),
    ('ATM cash withdrawal bank', 'Others'),
    ('Miscellaneous fee charge', 'Others')
]

# Create dataframes for training
df = pd.DataFrame(training_data, columns=['description', 'category'])

# Construct Scikit-Learn Naive Bayes text classification pipeline
classifier_pipeline = make_pipeline(
    TfidfVectorizer(lowercase=True, stop_words='english', ngram_range=(1, 2)),
    MultinomialNB(alpha=0.1)
)

# Train the model
classifier_pipeline.fit(df['description'], df['category'])

def predict_transaction_category(description):
    """
    Predicts the category of a transaction based on its text description.
    """
    if not description or not description.strip():
        return "Others"
        
    predicted = classifier_pipeline.predict([description])[0]
    return str(predicted)
