#!/usr/bin/env python3
"""
Build golden dataset from passing validation cases.
Extracts 26 passing roadmaps and creates a reference dataset with metadata.
"""

import json
import os
from pathlib import Path
from typing import Any

def load_manifest(manifest_path: str) -> dict:
    """Load and parse the evaluation manifest."""
    with open(manifest_path, 'r') as f:
        return json.load(f)

def load_response_file(response_file: str) -> dict:
    """Load a response file safely."""
    try:
        with open(response_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {response_file}: {e}")
        return None

def extract_roadmap(response_data: dict) -> dict | None:
    """Extract the roadmap topics from response."""
    try:
        if not response_data or 'raw' not in response_data:
            return None
        
        choices = response_data['raw'].get('choices', [])
        if not choices:
            return None
        
        content = choices[0]['message'].get('content', '')
        if not content:
            return None
        
        roadmap = json.loads(content)
        return roadmap.get('topics', [])
    except Exception as e:
        print(f"Error extracting roadmap: {e}")
        return None

def build_golden_dataset():
    """Build golden dataset from passing cases."""
    manifest_path = 'runs/manifest.json'
    manifest = load_manifest(manifest_path)
    
    golden_dataset = {
        "version": "1.0",
        "created_from_run": manifest_path,
        "run_timestamp": manifest['run_started'],
        "total_cases": len(manifest['results']),
        "passing_cases": sum(1 for r in manifest['results'] if r['ok']),
        "references": []
    }
    
    passing_count = 0
    
    for result in manifest['results']:
        if not result['ok']:
            continue
        
        response_file = result['response_file']
        case_id = result['case_id']
        
        # Load the response
        response_data = load_response_file(response_file)
        if not response_data:
            continue
        
        # Extract roadmap
        topics = extract_roadmap(response_data)
        if not topics:
            continue
        
        # Build golden reference
        meta = response_data.get('meta', {})
        case_info = meta.get('case', {})
        
        golden_ref = {
            "case_id": case_id,
            "position": case_info.get('position', ''),
            "company": case_info.get('company', ''),
            "days": case_info.get('days', 0),
            "hoursPerDay": case_info.get('hoursPerDay', 0),
            "majorTopic": case_info.get('majorTopic', ''),
            "total_hours": result['total_hours'],
            "target_hours": result['target_hours'],
            "num_topics": len(topics),
            "mean_title_similarity": result['mean_title_similarity'],
            "topics": topics,
            "metadata": {
                "model": meta.get('model', ''),
                "duration_sec": meta.get('duration_sec', 0),
                "prompt_hash": result['prompt_hash'],
            }
        }
        
        golden_dataset['references'].append(golden_ref)
        passing_count += 1
    
    # Save golden dataset
    output_path = 'golden_dataset.json'
    with open(output_path, 'w') as f:
        json.dump(golden_dataset, f, indent=2)
    
    print(f"✓ Golden dataset created: {output_path}")
    print(f"  - Total references: {passing_count}")
    print(f"  - Coverage: {passing_count}/{golden_dataset['total_cases']} cases")
    
    return golden_dataset

if __name__ == '__main__':
    build_golden_dataset()
