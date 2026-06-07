# Roadmap Validation Pipeline

Standalone roadmap-only AI evaluation pipeline for ThetaVerse.

## What it does
- Calls GROQ through the OpenAI-compatible chat API
- Forces structured roadmap output
- Validates the response against JSON Schema
- Checks time-fit, topic uniqueness, and reference-link quality
- Writes every run to a manifest with pass/fail metadata

## Files
- `roadmap_eval.py`: main runner
- `roadmap_schema.json`: response schema
- `sample_inputs.json`: demo evaluation cases
- `requirements.txt`: Python dependencies

## Setup
```powershell
cd ai-validation\roadmap
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run
Set your GROQ key as an environment variable first:

```powershell
$env:GROQ_API_KEY="your_key_here"
python roadmap_eval.py --input sample_inputs.json --out runs
```

Optional settings:
- `GROQ_MODEL`: override the model name
- `GROQ_BASE_URL`: override the API base URL
- `GROQ_TIMEOUT`: request timeout in seconds

## Output
The pipeline writes:
- `runs/manifest.json`
- one JSON file per generated sample
- one `*.failed.json` file for any invalid response

## Notes
- This folder is intentionally separate from the main app.
- No backend or frontend code is changed by this pipeline.
