# AI Loan Eligibility Checker

Dark glassmorphism BFSI web app: loan eligibility, credit score analyzer, EMI calculator and AI finance tips, powered by Claude via a Flask proxy. Submissions are saved to Google Sheets.

## Structure
```
loan-checker/
├── app.py              # Flask proxy: /api/analyze, serves static/
├── requirements.txt
├── .env.example        # copy to .env
├── .gitignore
├── apps_script/Code.gs # Google Apps Script doPost
└── static/
    ├── index.html
    ├── style.css
    └── script.js
```
**Flow:** browser (rules run in JS) → `POST /api/analyze` → Flask builds the prompt → Claude → JSON → UI. Flask then forwards the row to Apps Script, so the Sheets URL stays server-side.

## Local setup
```bash
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # add ANTHROPIC_API_KEY and SHEETS_URL
python app.py           # open http://localhost:5000
```

## Google Sheets setup
1. Create a new Google Sheet. Open **Extensions → Apps Script**.
2. Paste `apps_script/Code.gs` and save.
3. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone**. Deploy and authorize.
4. Copy the `/exec` URL into `SHEETS_URL` in `.env`.
5. Tabs `eligibility` and `credit` are created automatically on first submission (columns: Timestamp, Inputs, Result). Names are removed from the AI payload, so they are not stored.

## Deployment
**Render (recommended, full stack):** push to GitHub → New Web Service → Build `pip install -r requirements.txt` → Start `gunicorn app:app` → add env vars `ANTHROPIC_API_KEY`, `SHEETS_URL`, `CLAUDE_MODEL`.

**Netlify / GitHub Pages (frontend only):** deploy the `static/` folder, deploy the backend on Render, then set `window.API_BASE = "https://your-app.onrender.com"` in `index.html` and `ALLOWED_ORIGINS=https://your-site.netlify.app` on Render.

Never commit `.env`. Free Render instances sleep, so the first request may be slow.

## Baseline eligibility rules (script.js)
Age 21–60 · income ≥ ₹15,000 · credit score ≥ 650 · FOIR (existing EMIs + new EMI) ≤ 50% · loan ends before age 65. Rate = base (Personal 11, Home 8.5, Car 9, Education 9.5) + credit-score premium + 0.75 if not salaried.

## Testing checklist
| # | Test | Input | Expected |
|---|------|-------|----------|
| 1 | Eligible | Age 30, income 80000, Salaried, EMIs 10000, Personal, 500000, 5 yrs, score 780 | ✅ Eligible, rate ≈ 11.5%, FOIR ≈ 23%, AI text shown |
| 2 | Low score | Same as 1 but score 620 | ❌ "below 650", max amount ₹0 |
| 3 | High FOIR | Income 30000, EMIs 12000, 1000000, 3 yrs, score 750 | ❌ FOIR > 50% |
| 4 | Age limit | Age 19 / age 62 | ❌ age rule |
| 5 | Validation | Empty form; age 150; score 1000 | Inline errors, no API call |
| 6 | Credit: excellent | On time, util 5, age 12, inq 0, good mix | Score ≈ 880, "Excellent" |
| 7 | Credit: poor | Defaults, util 90, age 1, inq 6, limited mix | Score ≈ 340, "Poor" |
| 8 | EMI | 1000000, 10%, 5 yrs | EMI ≈ ₹21,247, interest ≈ ₹274,834, total ≈ ₹1,274,834, 60 table rows |
| 9 | Chat | Click a chip | Answer with disclaimer |
| 10 | Errors | Stop backend / use bad API key | Friendly red alert, no crash |
| 11 | Sheets | Submit tests 1 and 6 | New rows in `eligibility` and `credit` tabs |
| 12 | Responsive | Resize below 800px | Sidebar becomes top nav, forms stack |
