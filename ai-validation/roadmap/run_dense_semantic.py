#!/usr/bin/env python3
"""
Dense Semantic Validation Runner for Roadmap Curricula.
Uses Sentence-Transformers (deep learning embeddings) to compare generated roadmaps
with the golden reference dataset.
"""

import os
import json
import sys
from typing import List, Dict, Any

# Step 1: Check for sentence-transformers dependency
try:
    from sentence_transformers import SentenceTransformer, util
    import torch
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

def print_setup_instructions():
    print("=" * 70)
    print("ERROR: 'sentence-transformers' and/or 'torch' are not installed.")
    print("To run the dense semantic validation, please install them using:")
    print("\n    pip install sentence-transformers torch\n")
    print("Note: 'all-MiniLM-L6-v2' (~80MB model) will download automatically on first run.")
    print("=" * 70)

if not SENTENCE_TRANSFORMERS_AVAILABLE:
    print_setup_instructions()
    sys.exit(1)

# Ensure we can import from the current directory
sys.path.append(os.getcwd())
from run_pydantic_validation import load_manifest, load_case_response, extract_roadmap_topics

class DenseSemanticValidator:
    def __init__(self, golden_dataset_path: str, model_name: str = 'all-MiniLM-L6-v2'):
        print(f"Loading dense semantic embedding model '{model_name}'...")
        self.model = SentenceTransformer(model_name)
        
        # Load golden dataset
        with open(golden_dataset_path, 'r', encoding='utf-8') as f:
            self.golden_dataset = json.load(f)
            
    def compare_with_golden(self, topics: List[dict], position: str, company: str, match_threshold: float = 0.55) -> Dict[str, Any]:
        """Compare generated topics with golden reference using dense semantic embeddings."""
        # Find matching golden reference
        matching_refs = [
            ref for ref in self.golden_dataset['references']
            if ref['position'].lower() == position.lower() 
            and ref['company'].lower() == company.lower()
        ]
        
        if not matching_refs:
            return {"skipped": True, "reason": f"No golden references for {position} at {company}"}
            
        ref = matching_refs[0]
        
        # Build rich text representations combining title + subtopics
        gen_texts = [t["title"].strip() + " " + " ".join(t.get("subtopics", [])) for t in topics]
        ref_texts = [t["title"].strip() + " " + " ".join(t.get("subtopics", [])) for t in ref['topics']]
        
        ref_titles = [t["title"].strip() for t in ref['topics']]
        
        if not gen_texts or not ref_texts:
            return {"comparison_ok": False, "coverage_pct": 0.0, "matches": []}
            
        # 1. Compute Dense Embeddings
        # convert_to_tensor=True yields torch tensors directly on CPU/GPU
        gen_embeddings = self.model.encode(gen_texts, convert_to_tensor=True)
        ref_embeddings = self.model.encode(ref_texts, convert_to_tensor=True)
        
        # 2. Compute Cosine Similarity Matrix
        # shape: (len(gen_texts), len(ref_texts))
        sim_matrix = util.cos_sim(gen_embeddings, ref_embeddings)
        
        # Move back to CPU numpy for indexing
        sim_matrix_np = sim_matrix.cpu().numpy()
        
        matches = []
        unmatched_ref_titles = list(ref_titles)
        
        # For each generated topic, find the best matching reference topic
        for i, gen_text in enumerate(gen_texts):
            best_match_idx = int(np.argmax(sim_matrix_np[i]))
            best_sim = float(sim_matrix_np[i][best_match_idx])
            
            if best_sim >= match_threshold:
                ref_title = ref_titles[best_match_idx]
                matches.append({
                    "generated": topics[i]["title"],
                    "reference": ref_title,
                    "similarity": round(best_sim, 3)
                })
                if ref_title in unmatched_ref_titles:
                    unmatched_ref_titles.remove(ref_title)
                    
        # Coverage metric: percentage of reference topics that were matched
        coverage_pct = (len(ref_titles) - len(unmatched_ref_titles)) / len(ref_titles) * 100 if ref_titles else 100
        
        return {
            "comparison_ok": coverage_pct >= 25.0, # Calibrated for semantic dense validation
            "coverage_pct": round(coverage_pct, 1),
            "matches_count": len(matches),
            "unmatched_ref_count": len(unmatched_ref_titles),
            "unmatched_ref_topics": unmatched_ref_titles[:5],
            "matches": matches
        }

def run_dense_validation(
    manifest_path: str = 'runs_pydantic/manifest_pydantic.json',
    golden_path: str = 'golden_dataset_15.json',
    match_threshold: float = 0.55
):
    import numpy as np # Import locally as numpy is needed inside validator but not globally checked
    
    # Initialize validator
    validator = DenseSemanticValidator(golden_path)
    manifest = load_manifest(manifest_path)
    
    print("\n" + "=" * 60)
    print("DENSE SEMANTIC VALIDATION RESULTS (all-MiniLM-L6-v2)")
    print("=" * 60)
    
    passed_cases = 0
    total_cases = 0
    
    for i, case_result in enumerate(manifest['results'], 1):
        case_id = case_result['case_id']
        response_file = case_result['response_file']
        
        response_data = load_case_response(response_file)
        if not response_data:
            continue
            
        topics = extract_roadmap_topics(response_data)
        if topics is None:
            continue
            
        case_info = response_data.get('meta', {}).get('case', {})
        
        # Run comparison
        res = validator.compare_with_golden(
            topics=topics,
            position=case_info['position'],
            company=case_info['company'],
            match_threshold=match_threshold
        )
        
        total_cases += 1
        is_pass = res.get('comparison_ok', False)
        status_str = "PASS" if is_pass else "FAIL"
        if is_pass:
            passed_cases += 1
            
        print(f"[{i:02d}/15] {case_id}: {status_str} ({case_info.get('position')} @ {case_info.get('company')})")
        print(f"       Coverage: {res.get('coverage_pct')}% | Matches: {res.get('matches_count')}")
        
        # Print matched details
        for match in res.get('matches', [])[:3]:
            print(f"         - '{match['generated']}' matches '{match['reference']}' (Sim: {match['similarity']:.3f})")
        if res.get('matches_count') > 3:
            print(f"         - ... and {res.get('matches_count') - 3} more matches")
        print("-" * 60)
        
    print("\n" + "=" * 60)
    print(f"SUMMARY: {passed_cases}/{total_cases} cases passed Golden Comparison ({passed_cases/total_cases*100:.1f}%)")
    print(f"Used match threshold: {match_threshold}")
    print("=" * 60 + "\n")

if __name__ == '__main__':
    # Default threshold for dense embeddings can be higher (e.g. 0.55 or 0.60)
    # because semantic vectors yield higher baseline similarity than TF-IDF.
    import numpy as np
    run_dense_validation()
