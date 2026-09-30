import os, json, re, datetime
import requests, anthropic
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app, origins=os.getenv("ALLOWED_ORIGINS", "*").split(","))
client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from .env
MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5")
SHEETS_URL = os.getenv("SHEETS_URL", "")

SYSTEM = ("You are a friendly financial advisor for Indian retail customers. Use clear, "
          "non-technical language and practical steps. Always end with a one-line disclaimer that "
          "this is informational and not official financial advice.")

PROMPTS = {
    "eligibility": "Applicant data and rule-based result:\n{d}\nExplain the result in simple words and give 3-4 concrete improvement suggestions. "
                   'Reply ONLY with JSON: {{"explanation": "...", "suggestions": ["..."]}}',
    "credit": "Credit profile and estimated score:\n{d}\nExplain what drives this score and give 4 tips to improve it. "
              'Reply ONLY with JSON: {{"explanation": "...", "suggestions": ["..."]}}',
    "chat": "Question: {d}\nAnswer in under 150 words, simple and practical. "
            'Reply ONLY with JSON: {{"explanation": "..."}}',
}


def save_row(kind, inputs, result):
    if not SHEETS_URL:
        return
    try:
        requests.post(SHEETS_URL, timeout=8, data=json.dumps({
            "timestamp": datetime.datetime.utcnow().isoformat(), "type": kind,
            "inputs": inputs, "result": result}))
    except Exception as e:
        app.logger.warning("Sheets save failed: %s", e)


@app.route("/")
def home():
    return send_from_directory("static", "index.html")


@app.post("/api/analyze")
def analyze():
    body = request.get_json(silent=True) or {}
    kind, data = body.get("type"), body.get("data")
    if kind not in PROMPTS or not data:
        return jsonify(error="Invalid request."), 400
    if kind == "chat" and len(str(data)) > 1000:
        return jsonify(error="Question too long (max 1000 chars)."), 400
    try:
        msg = client.messages.create(
            model=MODEL, max_tokens=900, system=SYSTEM,
            messages=[{"role": "user", "content": PROMPTS[kind].format(d=json.dumps(data) if kind != "chat" else data)}])
        text = msg.content[0].text
        m = re.search(r"\{.*\}", text, re.S)
        try:
            out = json.loads(m.group(0)) if m else {"explanation": text}
        except json.JSONDecodeError:
            out = {"explanation": text}
    except anthropic.RateLimitError:
        return jsonify(error="Too many requests right now. Please retry in a minute."), 429
    except anthropic.APIError as e:
        app.logger.error(e)
        return jsonify(error="AI service is unavailable. Please try again."), 502
    if kind != "chat":
        save_row(kind, data, out)
    return jsonify(out)


if __name__ == "__main__":
    app.run(port=int(os.getenv("PORT", 5000)), debug=os.getenv("FLASK_DEBUG") == "1")
