import os
import re
import json

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


def generate_chatbot_reply(user_message, context, conversation_history=None):
    """
    Generates a warm, intelligent, human-like financial advisory response.
    Uses Claude Sonnet 5 with full conversation memory when available.
    Falls back to an enhanced mock advisor that still feels natural and helpful.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key or api_key.strip() == "" or api_key.startswith("your_"):
        return generate_mock_reply(user_message, context)

    if not ANTHROPIC_AVAILABLE:
        return generate_mock_reply(user_message, context)

    try:
        client = Anthropic(api_key=api_key)

        # ── Compose the rich financial context snapshot ──────────────────
        ctx_block = _build_context_block(context)

        # ── System prompt: warm, intelligent, human-like advisor ─────────
        system_prompt = f"""You are Aurelia, a brilliant and warm personal financial advisor built into WealthAI — a premium finance app.

Your personality:
- You speak like a knowledgeable best friend who happens to be a CFP (Certified Financial Planner)
- You are warm, empathetic, and conversational — never robotic or overly formal
- You use simple, clear English that anyone can understand — no unnecessary jargon
- You're direct and confident, but also caring about the user's wellbeing
- You occasionally use light warmth ("That's a great question!", "Honestly, I'd think about this differently...")
- You always give concrete, actionable advice — never vague platitudes
- You remember what was said earlier in the conversation and refer back to it naturally

REAL-TIME FINANCIAL DATA for {context.get('username', 'this user')}:
{ctx_block}

YOUR CAPABILITIES — you can write to the user's database. If they ask you to:
1. Log/add an expense or income → append this EXACTLY at the end of your reply:
||ACTION_START||
{{"action": "CREATE_TRANSACTION", "params": {{"type": "expense"|"income", "amount": <number>, "category": "<string>", "description": "<string>"}}}}
||ACTION_END||

2. Create a savings goal → append:
||ACTION_START||
{{"action": "CREATE_GOAL", "params": {{"name": "<string>", "target": <number>, "targetDate": "<YYYY-MM-DD>"}}}}
||ACTION_END||

3. Set a monthly budget → append:
||ACTION_START||
{{"action": "CREATE_BUDGET", "params": {{"category": "<string>", "limit": <number>}}}}
||ACTION_END||

RESPONSE STYLE RULES:
- Keep replies concise but complete — aim for 100-200 words for normal questions, up to 350 for complex analysis
- Use markdown formatting: **bold** for emphasis, bullet points for lists, tables for data comparisons
- When showing financial data, use clean formatted tables
- If the user says hi/hello/how are you — respond warmly and naturally, mention you're here to help with their finances
- If asked something unrelated to finance (e.g. "what is 2+2", "tell me a joke") — answer it briefly and warmly, then gently steer back
- Don't start every message with "Of course!" or "Certainly!" — vary your openings naturally
- Reference their actual numbers whenever relevant (their income is ₹{context.get('totalIncome', 0):,}, expenses ₹{context.get('totalExpense', 0):,})
- If they have no data yet, encourage them to add transactions rather than giving generic advice
- Always end with a natural follow-up question or offer to dig deeper"""

        # ── Build messages array with conversation history ───────────────
        messages = []
        if conversation_history:
            for msg in conversation_history[-8:]:  # Last 8 messages for memory
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": user_message})

        response = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=1200,
            temperature=0.7,      # Higher temperature = more natural/human feel
            system=system_prompt,
            messages=messages
        )

        return response.content[0].text

    except Exception as e:
        print(f"Anthropic API call failed: {e}")
        return generate_mock_reply(user_message, context)


def _build_context_block(context):
    """Formats the user's financial data into a readable context block."""
    lines = []
    total_income = context.get('totalIncome', 0)
    total_expense = context.get('totalExpense', 0)
    net_savings = context.get('netSavings', 0)
    savings_rate = context.get('savingsRate', '0')

    lines.append(f"- Monthly Income: ₹{total_income:,}")
    lines.append(f"- Monthly Expenses: ₹{total_expense:,}")
    lines.append(f"- Net Savings: ₹{net_savings:,}")
    lines.append(f"- Savings Rate: {savings_rate}%")

    breakdown = context.get('categoryBreakdown', [])
    if breakdown:
        breakdown_str = ", ".join([f"{c['category']} ₹{c['amount']:,}" for c in breakdown[:6]])
        lines.append(f"- Expense Breakdown: {breakdown_str}")

    recent_tx = context.get('recentTransactions', [])
    if recent_tx:
        tx_strs = []
        for t in recent_tx[:8]:
            flag = " ⚠️SUSPICIOUS" if t.get('isAnomaly') else ""
            sign = "+" if t['type'] == 'income' else "-"
            tx_strs.append(f"{t['date']} {t['category']} ({t['description']}): {sign}₹{t['amount']:,}{flag}")
        lines.append(f"- Recent Transactions: {'; '.join(tx_strs)}")

    predictions = context.get('predictions', {})
    if predictions:
        pred_str = ", ".join([f"{cat}: ₹{float(amt):,.0f}" for cat, amt in predictions.items()])
        lines.append(f"- AI Predicted Next Month: {pred_str}")

    if not breakdown and not recent_tx:
        lines.append("- Note: This user has no transactions logged yet. Encourage them to start tracking!")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════
#  Helper: Map free-text categories to standard ones
# ═══════════════════════════════════════════════════════════════════
def map_category(cat_str):
    c = cat_str.lower().strip()
    if any(k in c for k in ["food", "dine", "eat", "restaurant", "zomato", "swiggy", "cafe", "coffee", "lunch", "dinner", "breakfast"]):
        return "Food"
    if any(k in c for k in ["grocery", "groceries", "supermarket", "mart", "dmart", "vegetables", "milk"]):
        return "Groceries"
    if any(k in c for k in ["rent", "lease", "pg", "room", "hostel"]):
        return "Rent"
    if any(k in c for k in ["util", "bill", "electric", "electricity", "water", "gas", "phone", "internet", "wifi", "recharge", "mobile"]):
        return "Utilities"
    if any(k in c for k in ["movie", "netflix", "spotify", "amazon prime", "hotstar", "ent", "fun", "show", "play", "game", "music", "concert"]):
        return "Entertainment"
    if any(k in c for k in ["cab", "uber", "ola", "auto", "metro", "train", "bus", "travel", "transport", "flight", "petrol", "fuel"]):
        return "Transport"
    if any(k in c for k in ["shop", "cloth", "buy", "amazon", "flipkart", "myntra", "fashion", "shoes", "dress"]):
        return "Shopping"
    if any(k in c for k in ["health", "doctor", "med", "pharmacy", "clinic", "hospital", "gym", "fitness"]):
        return "Healthcare"
    if any(k in c for k in ["salary", "pay", "job", "wage", "stipend"]):
        return "Salary"
    if any(k in c for k in ["freelance", "gig", "bonus", "project", "consulting", "client"]):
        return "Freelance"
    if any(k in c for k in ["invest", "sip", "mutual fund", "stock", "equity", "fd", "fixed deposit"]):
        return "Investment"
    if any(k in c for k in ["edu", "course", "book", "college", "school", "tuition", "fee", "exam"]):
        return "Education"
    return cat_str.capitalize()


# ═══════════════════════════════════════════════════════════════════
#  Smart Rule-Based Mock Advisor (used when no Claude API key)
#  Now much more human-like and conversational
# ═══════════════════════════════════════════════════════════════════
def generate_mock_reply(message, context):
    msg_lower = message.lower()

    username = context.get('username', 'there')
    net_savings = context.get('netSavings', 0)
    total_expense = context.get('totalExpense', 0)
    total_income = context.get('totalIncome', 0)
    breakdown = context.get('categoryBreakdown', [])
    recent_tx = context.get('recentTransactions', [])
    predictions = context.get('predictions', {})
    savings_rate_str = context.get('savingsRate', '0')
    try:
        savings_rate = float(savings_rate_str)
    except (ValueError, TypeError):
        savings_rate = 0.0

    # ── 0. Agentic write intents (log transaction) ─────────────────
    tx_match = re.search(
        r'(?:log|add|create|record)\s+(expense|income)\s+(?:of\s+)?(?:rs\.?|inr|₹)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s+(?:for|under|category)\s+([a-zA-Z\s]+?)(?:\s+(?:labeled|description|desc|note)\s+([a-zA-Z0-9\s._,-]+))?$',
        msg_lower
    )
    if tx_match:
        tx_type = tx_match.group(1).strip()
        amount = float(tx_match.group(2).replace(',', ''))
        category = map_category(tx_match.group(3).strip())
        description = tx_match.group(4).strip().title() if tx_match.group(4) else "Logged via Aurelia"

        reply = (
            f"Done! I've logged that for you. ✅\n\n"
            f"Here's the summary of what was recorded:\n"
            f"- **Type**: {tx_type.capitalize()}\n"
            f"- **Amount**: ₹{amount:,.0f}\n"
            f"- **Category**: {category}\n"
            f"- **Note**: \"{description}\"\n\n"
            f"Your dashboard will now reflect this. Want me to check how it affects your monthly budget?"
        )
        action_obj = {
            "action": "CREATE_TRANSACTION",
            "params": {"type": tx_type, "amount": amount, "category": category, "description": description}
        }
        payload = f"||ACTION_START||\n{json.dumps(action_obj)}\n||ACTION_END||"
        return f"{reply}\n\n{payload}"

    # ── Goal creation ──────────────────────────────────────────────
    goal_match = re.search(
        r'(?:create|add|set)\s+(?:a\s+)?(?:savings\s+)?goal\s+(?:named|called|for)?\s*([a-zA-Z0-9\s_-]+?)\s+(?:with\s+)?(?:target|amount|of)?\s*(?:rs\.?|inr|₹)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s+(?:by|deadline|date)\s+(\d{4}-\d{2}-\d{2})',
        msg_lower
    )
    if goal_match:
        name = goal_match.group(1).strip().title()
        target = float(goal_match.group(2).replace(',', ''))
        target_date = goal_match.group(3).strip()
        months_needed = round(target / max(net_savings, 1))

        reply = (
            f"Your savings goal has been created! 🎯\n\n"
            f"- **Goal**: {name}\n"
            f"- **Target**: ₹{target:,.0f}\n"
            f"- **Deadline**: {target_date}\n\n"
            f"At your current savings velocity of ₹{net_savings:,}/month, you'd reach this in about **{months_needed} months**. "
            f"{'That aligns well with your deadline!' if months_needed <= 24 else 'You may want to increase your monthly savings to hit this on time.'}"
        )
        action_obj = {
            "action": "CREATE_GOAL",
            "params": {"name": name, "target": target, "targetDate": target_date}
        }
        payload = f"||ACTION_START||\n{json.dumps(action_obj)}\n||ACTION_END||"
        return f"{reply}\n\n{payload}"

    # ── Budget creation ────────────────────────────────────────────
    budget_match = re.search(
        r'(?:set|create|update)\s+(?:a\s+)?budget\s+(?:for\s+)?([a-zA-Z]+)\s+(?:to|at|limit)?\s*(?:rs\.?|inr|₹)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)',
        msg_lower
    )
    if budget_match:
        category = map_category(budget_match.group(1).strip())
        limit = float(budget_match.group(2).replace(',', ''))

        reply = (
            f"Budget set! I've configured ₹{limit:,.0f} as your monthly limit for **{category}**. 📊\n\n"
            f"I'll keep an eye on your spending in this category and let you know if you're heading toward the limit. "
            f"Want me to set budgets for any other categories?"
        )
        action_obj = {
            "action": "CREATE_BUDGET",
            "params": {"category": category, "limit": limit}
        }
        payload = f"||ACTION_START||\n{json.dumps(action_obj)}\n||ACTION_END||"
        return f"{reply}\n\n{payload}"

    # ── Greetings ──────────────────────────────────────────────────
    if any(k in msg_lower for k in ["hello", "hi ", "hey", "good morning", "good evening", "good afternoon", "howdy", "sup ", "what's up"]):
        hour = __import__('datetime').datetime.now().hour
        time_greet = "Good morning" if hour < 12 else ("Good afternoon" if hour < 17 else "Good evening")
        if total_income > 0 or total_expense > 0:
            return (
                f"{time_greet}, {username}! Great to hear from you. 😊\n\n"
                f"Quick snapshot of where you're at: you've saved **₹{net_savings:,}** this period with a savings rate of **{savings_rate_str}%**. "
                f"{'Looking solid!' if savings_rate >= 20 else 'There is some room to grow your savings.'}\n\n"
                f"What would you like to dig into today? I can analyze your spending, forecast next month's expenses, or help you plan for a goal."
            )
        else:
            return (
                f"{time_greet}, {username}! I'm Aurelia, your personal financial advisor here in WealthAI. 👋\n\n"
                f"Looks like you're just getting started — no transactions logged yet. Once you start tracking your income and expenses, "
                f"I can give you real personalized insights, forecasts, and advice.\n\n"
                f"Head over to the **Transactions** page to add your first entry, or just tell me something like: "
                f"*\"log expense of 500 for Food\"* and I'll do it for you right here!"
            )

    # ── Expense predictions ────────────────────────────────────────
    if any(k in msg_lower for k in ["predict", "forecast", "next month", "future spend", "projection"]):
        if predictions:
            rows = "\n".join([f"| {cat} | ₹{float(amt):,.0f} |" for cat, amt in predictions.items()])
            total_pred = sum(float(v) for v in predictions.values())
            return (
                f"Based on your spending history, here's what I'm projecting for next month:\n\n"
                f"| Category | Projected Spend |\n"
                f"| --- | --- |\n"
                f"{rows}\n"
                f"| **Total** | **₹{total_pred:,.0f}** |\n\n"
                f"{'Your projected total looks manageable relative to your income.' if total_pred < total_income * 0.7 else 'Heads up — the projected spend is high relative to your income. You may want to trim some categories.'}\n\n"
                f"Want me to suggest specific cuts to improve your savings margin?"
            )
        else:
            return (
                f"I'd love to give you a forecast, {username}, but I need more data to work with. "
                f"The AI model needs at least a few weeks of transaction history across multiple months to build accurate predictions.\n\n"
                f"Keep logging your daily expenses and I'll be able to give you very precise next-month forecasts soon! "
                f"In the meantime, a good rule of thumb is to budget last month's spend + 10% buffer for each category."
            )

    # ── Savings analysis ───────────────────────────────────────────
    if any(k in msg_lower for k in ["saving", "savings rate", "velocity", "how much am i saving", "save more"]):
        if savings_rate >= 50:
            verdict = f"🌟 Incredible! A {savings_rate_str}% savings rate puts you in the top tier of savers. You're building wealth fast."
            tip = "At this rate, you could consider putting some of those savings into SIPs or index funds to beat inflation."
        elif savings_rate >= 30:
            verdict = f"💪 Strong work — {savings_rate_str}% is well above the 20% benchmark. You're on track."
            tip = "Keep this up and consider automating your investments so savings happen before you can spend them."
        elif savings_rate >= 15:
            verdict = f"📈 You're at {savings_rate_str}% — decent, but there's room to push toward the 20-30% range."
            tip = "Try the 24-hour rule: wait a day before any non-essential purchase. It cuts impulse spending significantly."
        else:
            verdict = f"⚠️ At {savings_rate_str}%, your savings margin is tight. Let's fix that."
            tip = "First step: look at your top 2 expense categories and set a firm monthly cap. Small cuts compound quickly."

        return (
            f"{verdict}\n\n"
            f"| Metric | Amount |\n"
            f"| --- | --- |\n"
            f"| Monthly Income | ₹{total_income:,} |\n"
            f"| Monthly Expenses | ₹{total_expense:,} |\n"
            f"| Net Savings | ₹{net_savings:,} |\n"
            f"| Savings Rate | {savings_rate_str}% |\n\n"
            f"**My take:** {tip}\n\n"
            f"Want me to run a detailed budget leak audit?"
        )

    # ── Anomaly check ──────────────────────────────────────────────
    if any(k in msg_lower for k in ["anomaly", "suspicious", "unusual", "outlier", "flag", "weird charge"]):
        anomalies = [t for t in recent_tx if t.get('isAnomaly')]
        if anomalies:
            tx_list = "\n".join([f"- **₹{t['amount']:,}** in {t['category']} on {t['date']} — \"{t['description']}\"" for t in anomalies])
            return (
                f"I found **{len(anomalies)} transaction(s)** that look statistically unusual compared to your normal spending:\n\n"
                f"{tx_list}\n\n"
                f"These were flagged by the Isolation Forest model because their amounts deviate significantly from your typical range in those categories. "
                f"They might be totally legit (like a one-time big purchase), or worth double-checking.\n\n"
                f"Do you recognize all of these? If any look wrong, you can delete them from the Transactions page."
            )
        else:
            return (
                f"Good news — I ran through your recent transactions and everything looks clean. ✅\n\n"
                f"No unusual spending patterns or anomalous charges detected. Your spending is consistent with your historical behavior in each category.\n\n"
                f"I'll keep monitoring in the background. Want me to analyze your budget efficiency instead?"
            )

    # ── Affordability check ────────────────────────────────────────
    numbers = re.findall(r'(?:₹|rs\.?|inr)?\s*(\d[\d,]*)', msg_lower)
    amounts_asked = []
    for num in numbers:
        try:
            amounts_asked.append(float(num.replace(',', '')))
        except ValueError:
            continue

    if any(k in msg_lower for k in ["afford", "can i buy", "should i buy", "safe to spend", "okay to spend"]) and amounts_asked:
        target = amounts_asked[0]
        if net_savings >= target * 3:
            verdict = f"Yes, comfortably. ₹{target:,.0f} is well within your means — you have ₹{net_savings:,} in net savings this period, which is {int(net_savings/target)}x this amount."
            advice = "Just make sure it won't push you below your monthly savings goal."
        elif net_savings >= target:
            remaining = net_savings - target
            verdict = f"Yes, but it'll be tight. You can afford ₹{target:,.0f}, but you'd be left with only ₹{remaining:,} as a buffer."
            advice = "I'd recommend only going ahead if this is a necessary or high-value purchase."
        else:
            shortfall = target - net_savings
            verdict = f"Honestly, I'd hold off. Your current net savings are ₹{net_savings:,}, which is ₹{shortfall:,} short of this purchase."
            advice = "If this is something you really want, start setting aside a specific amount each month and I can help you create a savings goal for it."

        return f"{verdict}\n\n**My advice:** {advice}\n\nWant me to create a savings goal for this?"

    # ── Overspending / budget leaks ────────────────────────────────
    if any(k in msg_lower for k in ["overspend", "leak", "where am i spending", "spending too much", "budget", "breakdown"]):
        if not breakdown:
            return (
                f"No expenses tracked yet, {username}! Once you start logging transactions, "
                f"I can give you a detailed breakdown of exactly where your money is going and where to cut.\n\n"
                f"Try adding your first expense — I can even do it for you: just say something like *\"log expense of 800 for Food\"*"
            )
        rows = "\n".join([
            f"| {b['category']} | ₹{b['amount']:,} | {b['amount']/total_expense*100:.1f}% |"
            for b in breakdown
        ]) if total_expense > 0 else ""

        top = breakdown[0]
        potential_save = int(top['amount'] * 0.15)
        return (
            f"Here's where your money is going:\n\n"
            f"| Category | Spent | Share |\n"
            f"| --- | --- | --- |\n"
            f"{rows}\n\n"
            f"**Biggest category: {top['category']}** at ₹{top['amount']:,}.\n"
            f"If you trimmed this by just 15%, you'd free up **₹{potential_save:,}** per month — that's ₹{potential_save*12:,} a year.\n\n"
            f"Want a category-by-category advice plan?"
        )

    # ── General financial question fallback ────────────────────────
    if any(k in msg_lower for k in ["sip", "mutual fund", "index fund", "stocks", "invest", "equity", "fd", "fixed deposit", "nps", "ppf", "elss", "ltcg", "stcg", "emi"]):
        term = next((k for k in ["sip", "mutual fund", "index fund", "emi", "ltcg", "stcg", "elss", "nps", "ppf", "fd"] if k in msg_lower), "investment")
        explanations = {
            "sip": "A **SIP (Systematic Investment Plan)** lets you invest a fixed amount into a mutual fund every month automatically. It's one of the best ways to build wealth over time because of rupee cost averaging — you buy more units when prices are low and fewer when high. Even ₹1,000/month over 10 years at 12% returns becomes ~₹23 lakhs.",
            "mutual fund": "**Mutual funds** pool money from many investors and invest in a diversified portfolio of stocks, bonds, or both. They're managed by professional fund managers. For most people, a low-cost index fund is the best starting point.",
            "index fund": "**Index funds** simply track a market index like Nifty 50 or Sensex. They have very low fees and historically outperform most actively managed funds over the long run. Warren Buffett recommends them for most investors.",
            "emi": "**EMI (Equated Monthly Installment)** is a fixed payment you make each month to repay a loan. The key is to keep all EMIs combined under 40% of your take-home salary — beyond that, it starts stressing your cash flow.",
            "ltcg": "**LTCG (Long-Term Capital Gains)** tax in India applies when you sell equity assets held for more than 1 year. Gains above ₹1 lakh per year are taxed at 10% (as of current rules). Planning your selling to stay under this limit each year is smart tax optimization.",
            "stcg": "**STCG (Short-Term Capital Gains)** applies when you sell equity within 1 year. It's taxed at a flat 15%. That's why holding investments for at least 12 months is usually better — you move from 15% to 10% tax.",
            "elss": "**ELSS (Equity Linked Savings Scheme)** is a type of mutual fund that qualifies for tax deduction under Section 80C (up to ₹1.5 lakh). It has the shortest lock-in period (3 years) among tax-saving instruments and historically gives equity-level returns.",
            "nps": "**NPS (National Pension System)** is a government-backed retirement savings plan. Contributions get tax benefits under 80CCD(1B) up to ₹50,000 over the 80C limit. It's especially powerful for salaried people in the 30%+ tax bracket.",
            "ppf": "**PPF (Public Provident Fund)** is a government-backed savings scheme with a 15-year lock-in. The interest (currently 7.1%) is completely tax-free, and contributions qualify for 80C. It's essentially risk-free compounding.",
            "fd": "**FD (Fixed Deposit)** gives you a guaranteed return (currently 6-7.5% in most banks) for a fixed period. The interest is taxable, which reduces real returns. Good for emergency funds or short-term goals, but not ideal for long-term wealth creation compared to equity."
        }
        explanation = explanations.get(term, f"I'd be happy to explain {term} in detail!")
        return (
            f"{explanation}\n\n"
            f"Based on your current savings of ₹{net_savings:,}/month, you could start with a small SIP if you haven't already. "
            f"Even ₹2,000-5,000/month invested consistently makes a massive difference over 10+ years.\n\n"
            f"Want me to help you figure out how much you can invest each month given your expenses?"
        )

    # ── General fallback ───────────────────────────────────────────
    if total_income > 0 or total_expense > 0:
        health = "on a solid footing" if savings_rate >= 20 else "with room to improve your savings"
        top_cats = ", ".join([b['category'] for b in breakdown[:3]]) if breakdown else "no categories yet"
        return (
            f"Hey {username}! Here's your current financial snapshot:\n\n"
            f"| Metric | Value |\n"
            f"| --- | --- |\n"
            f"| Income | ₹{total_income:,} |\n"
            f"| Expenses | ₹{total_expense:,} |\n"
            f"| Net Savings | ₹{net_savings:,} |\n"
            f"| Savings Rate | {savings_rate_str}% |\n\n"
            f"You're {health}. Your biggest spending categories are: {top_cats}.\n\n"
            f"I can help you with:\n"
            f"- **Spending analysis** — where your money is going\n"
            f"- **Budget planning** — set limits by category\n"
            f"- **Savings goals** — create and track progress\n"
            f"- **Expense forecasting** — predict next month's spend\n"
            f"- **Financial education** — explain SIPs, ELSS, EMIs, etc.\n\n"
            f"What would you like to explore?"
        )
    else:
        return (
            f"Hi {username}! I'm Aurelia, your financial advisor in WealthAI. 👋\n\n"
            f"I don't see any transactions yet, so I can't give you personalized analysis. "
            f"But once you start tracking, I can:\n"
            f"- Show exactly where your money goes\n"
            f"- Flag suspicious or unusual charges\n"
            f"- Predict next month's expenses by category\n"
            f"- Tell you if you can afford a specific purchase\n"
            f"- Help you set and track savings goals\n\n"
            f"To get started, go to **Transactions** and log your first entry — or just tell me here: "
            f"*\"log expense of 500 for food\"* and I'll add it for you!"
        )
