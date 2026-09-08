import os
import json
import requests
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# IBM Granite Configuration
IBM_API_KEY = os.getenv("IBM_API_KEY", "cTcLQn8_JldCE38qyGc67T9yyME__TNh3DnoPAo44XSr")
IBM_PROJECT_ID = os.getenv("IBM_PROJECT_ID", "39173fb7-605e-40ee-9a4a-ffcfe0195776")
IBM_MODEL_ID = os.getenv("IBM_MODEL_ID", "ibm/granite-4-h-small")
IBM_GENERATION_URL = os.getenv(
    "IBM_GENERATION_URL",
    "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29"
)
IBM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"

_iam_token_cache = {"token": None}


def get_iam_token():
    """Exchange IBM API key for an IAM bearer token."""
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
        "apikey": IBM_API_KEY,
    }
    response = requests.post(IBM_TOKEN_URL, headers=headers, data=data, timeout=30)
    response.raise_for_status()
    _iam_token_cache["token"] = response.json()["access_token"]
    return _iam_token_cache["token"]


def build_prompt(content: str, subject: str, level: str) -> str:
    level_guides = {
        "beginner": (
            "Use very simple language, avoid jargon, use relatable everyday analogies, "
            "short sentences, and assume zero prior knowledge."
        ),
        "intermediate": (
            "Use clear, concise language. Introduce technical terms with brief explanations. "
            "Assume some foundational knowledge but avoid heavy jargon."
        ),
        "expert": (
            "Use precise technical language. Assume strong domain knowledge. "
            "Focus on nuance, edge cases, and deeper connections."
        ),
    }
    guide = level_guides.get(level.lower(), level_guides["intermediate"])

    return f"""You are an expert educational content simplifier.

Subject area: {subject if subject else "General"}
Target learner level: {level.upper()}
Instruction: {guide}

Academic content to simplify:
\"\"\"
{content}
\"\"\"

Respond ONLY with a valid JSON object in this exact structure (no extra text before or after):
{{
  "simplified_explanation": "<clear explanation tailored to the {level} level>",
  "key_concepts": ["<concept 1>", "<concept 2>", "<concept 3>"],
  "important_terms": [
    {{"term": "<term>", "definition": "<simple definition>"}},
    {{"term": "<term>", "definition": "<simple definition>"}}
  ],
  "example": "<a concrete, relatable example that illustrates the main idea>",
  "summary": "<one or two sentence summary of the core idea>"
}}"""


def call_granite(prompt: str) -> dict:
    """Call IBM Granite text generation API and parse the JSON response."""
    token = get_iam_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "model_id": IBM_MODEL_ID,
        "project_id": IBM_PROJECT_ID,
        "input": prompt,
        "parameters": {
            "decoding_method": "greedy",
            "max_new_tokens": 1200,
            "min_new_tokens": 100,
            "stop_sequences": [],
            "repetition_penalty": 1.05,
        },
    }
    response = requests.post(IBM_GENERATION_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()

    raw_text = response.json()["results"][0]["generated_text"].strip()

    # Extract JSON block even if the model adds surrounding text
    start = raw_text.find("{")
    end = raw_text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError("Model did not return a valid JSON object.")
    json_str = raw_text[start:end]
    return json.loads(json_str)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/simplify", methods=["POST"])
def simplify():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid request body."}), 400

    content = (data.get("content") or "").strip()
    subject = (data.get("subject") or "General").strip()
    level = (data.get("level") or "intermediate").strip().lower()

    if not content:
        return jsonify({"error": "Academic content cannot be empty."}), 400
    if len(content) < 20:
        return jsonify({"error": "Please provide more content (at least 20 characters)."}), 400
    if level not in ("beginner", "intermediate", "expert"):
        return jsonify({"error": "Level must be beginner, intermediate, or expert."}), 400

    try:
        prompt = build_prompt(content, subject, level)
        result = call_granite(prompt)
        return jsonify({"success": True, "level": level, "subject": subject, "result": result})
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code if e.response is not None else 500
        msg = f"IBM Granite API error ({status}): {e.response.text[:200] if e.response else str(e)}"
        return jsonify({"error": msg}), 502
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Network error contacting IBM Granite: {str(e)}"}), 502
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        return jsonify({"error": f"Failed to parse model response: {str(e)}"}), 500


@app.route("/api/compare", methods=["POST"])
def compare():
    """Generate simplified output for all three levels at once."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid request body."}), 400

    content = (data.get("content") or "").strip()
    subject = (data.get("subject") or "General").strip()

    if not content:
        return jsonify({"error": "Academic content cannot be empty."}), 400

    results = {}
    errors = {}
    for level in ("beginner", "intermediate", "expert"):
        try:
            prompt = build_prompt(content, subject, level)
            results[level] = call_granite(prompt)
        except Exception as e:
            errors[level] = str(e)

    return jsonify({"success": True, "results": results, "errors": errors})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
