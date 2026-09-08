# Course Content Simplifier
**AI-powered academic content simplification using IBM Granite via watsonx.ai**

---

## Tech Stack
| Layer | Technology |
|---|---|
| AI Model | IBM Granite (`ibm/granite-4-h-small`) |
| AI Platform | IBM watsonx.ai (us-south) |
| Backend | Python 3.10+ / Flask |
| Frontend | HTML5 · CSS3 · Vanilla JS |
| Deployment | IBM Cloud (Gunicorn / Procfile) |

---

## Quick Start (Local)

### 1. Install dependencies
```bash
cd course-simplifier
pip install -r requirements.txt
```

### 2. Set up credentials
```bash
cp .env.example .env
# Open .env and set IBM_API_KEY to your real key
```

### 3. Run the server
```bash
python app.py
```
Open **http://localhost:5000** in your browser.

> **Keyboard shortcut:** `Ctrl+Enter` (or `Cmd+Enter`) submits the form.

---

## Features
| Feature | Description |
|---|---|
| Level Adaptation | Beginner · Intermediate · Expert |
| Structured Output | Explanation · Key Concepts · Terms · Example · Summary |
| Compare Levels | Side-by-side view for all 3 levels in one click |
| Regenerate | Re-run the same query |
| Try Another Level | Cycle through levels automatically |
| Copy Output | Copy full structured result to clipboard |
| Error Handling | Empty input · API failures · Invalid responses |

---

## API Endpoints

### `POST /api/simplify`
```json
{
  "content": "Academic text here...",
  "subject": "Physics",
  "level": "beginner"
}
```
**Response:**
```json
{
  "success": true,
  "level": "beginner",
  "subject": "Physics",
  "result": {
    "simplified_explanation": "...",
    "key_concepts": ["..."],
    "important_terms": [{"term": "...", "definition": "..."}],
    "example": "...",
    "summary": "..."
  }
}
```

### `POST /api/compare`
Generates all three levels at once. Same request body (no `level` field needed).

---

## IBM Cloud Deployment
```bash
ibmcloud cf push course-simplifier \
  --buildpack python_buildpack \
  -e IBM_API_KEY=<your_key>
```
Or use the IBM Code Engine / Cloud Foundry dashboard and set environment variables via the UI.

---

## Project Structure
```
course-simplifier/
├── app.py                  # Flask backend + IBM Granite integration
├── requirements.txt
├── Procfile                # IBM Cloud / Heroku deployment
├── .env.example            # Credential template
├── templates/
│   └── index.html          # Full responsive UI
└── static/
    ├── css/style.css
    └── js/script.js
```
