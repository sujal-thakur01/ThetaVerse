import os
import json
import numpy as np
import matplotlib.pyplot as plt
import sys
from typing import Dict, List, Any

# Step 1: Check dependencies
try:
    from sentence_transformers import SentenceTransformer, util
    import torch
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    print("ERROR: sentence-transformers not found. Please install using 'pip install sentence-transformers torch'")
    sys.exit(1)

# Ensure we can import from the current directory
sys.path.append(os.getcwd())
from run_pydantic_validation import load_manifest, load_case_response, extract_roadmap_topics

def sweep_dense_thresholds(
    manifest_path: str = 'runs_pydantic/manifest_pydantic.json',
    golden_path: str = 'golden_dataset_15.json'
):
    # 1. Load resources
    manifest = load_manifest(manifest_path)
    
    with open(golden_path, 'r', encoding='utf-8') as f:
        golden_dataset = json.load(f)
        
    print("Loading Sentence-Transformer model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # 2. Pre-compute similarity matrices for all cases once
    # This avoids encoding in nested loops, making the sweep instantaneous
    precomputed_cases = []
    
    for case_result in manifest['results']:
        case_id = case_result['case_id']
        response_file = case_result['response_file']
        
        response_data = load_case_response(response_file)
        if not response_data:
            continue
            
        topics = extract_roadmap_topics(response_data)
        if topics is None:
            continue
            
        case_info = response_data.get('meta', {}).get('case', {})
        position = case_info['position']
        company = case_info['company']
        
        # Find matching golden reference
        matching_refs = [
            ref for ref in golden_dataset['references']
            if ref['position'].lower() == position.lower() 
            and ref['company'].lower() == company.lower()
        ]
        
        if not matching_refs:
            continue
            
        ref = matching_refs[0]
        
        gen_texts = [t["title"].strip() + " " + " ".join(t.get("subtopics", [])) for t in topics]
        ref_texts = [t["title"].strip() + " " + " ".join(t.get("subtopics", [])) for t in ref['topics']]
        ref_titles = [t["title"].strip() for t in ref['topics']]
        
        # Encode strings
        gen_embeddings = model.encode(gen_texts, convert_to_tensor=True)
        ref_embeddings = model.encode(ref_texts, convert_to_tensor=True)
        
        # Cosine similarity matrix
        sim_matrix = util.cos_sim(gen_embeddings, ref_embeddings).cpu().numpy()
        
        precomputed_cases.append({
            "case_id": case_id,
            "ref_titles": ref_titles,
            "sim_matrix": sim_matrix
        })

    # 3. Perform the Sweep
    # Since dense similarity scores are higher, we sweep from 0.30 to 0.90
    match_thresholds = np.arange(0.30, 0.91, 0.05)
    coverage_thresholds = [15.0, 30.0, 40.0, 50.0]
    
    sweep_results = {cov: [] for cov in coverage_thresholds}
    
    for cov_thresh in coverage_thresholds:
        for match_thresh in match_thresholds:
            pass_count = 0
            
            for case in precomputed_cases:
                ref_titles = case["ref_titles"]
                sim_matrix = case["sim_matrix"]
                
                # Count matches
                unmatched_ref_titles = list(ref_titles)
                matches_count = 0
                
                for i in range(sim_matrix.shape[0]):
                    best_match_idx = int(np.argmax(sim_matrix[i]))
                    best_sim = float(sim_matrix[i][best_match_idx])
                    
                    if best_sim >= match_thresh:
                        ref_title = ref_titles[best_match_idx]
                        matches_count += 1
                        if ref_title in unmatched_ref_titles:
                            unmatched_ref_titles.remove(ref_title)
                
                coverage_pct = (len(ref_titles) - len(unmatched_ref_titles)) / len(ref_titles) * 100 if ref_titles else 100
                if coverage_pct >= cov_thresh:
                    pass_count += 1
                    
            sweep_results[cov_thresh].append(pass_count)

    # 4. Plotting
    plt.figure(figsize=(10, 6))
    
    colors = {
        15.0: '#1e88e5', # Blue
        30.0: '#8e24aa', # Purple
        40.0: '#43a047', # Green
        50.0: '#fb8c00'  # Orange
    }
    
    for cov_thresh, pass_counts in sweep_results.items():
        plt.plot(
            match_thresholds, 
            pass_counts, 
            label=f'Coverage Threshold: {cov_thresh:.0f}%', 
            color=colors[cov_thresh],
            marker='o',
            linewidth=2,
            markersize=6
        )
        
    # Highlighting dense validation calibration: Match Thresh 0.55, Coverage 25%
    # We find the index of 0.55 in match_thresholds
    idx_55 = np.where(np.isclose(match_thresholds, 0.55))[0][0]
    # Check what the pass count is for 15% and 30% coverage at 0.55 match
    # Since we set coverage threshold as 25% in the validator, we can interpolate or show it
    # Let's plot our selected calibration point: Sim 0.55, Coverage 25% (we use 30% curve as it's the closest visual line)
    pass_55_30 = sweep_results[30.0][idx_55]
    
    plt.plot(
        0.55, pass_55_30, 
        marker='*', 
        color='#e53935', 
        markersize=14, 
        label='Selected Calibration (0.55 Sim, 25% Cov)',
        linestyle='None'
    )
    
    plt.annotate(
        f'Calibrated Point ({pass_55_30}/15 Pass)',
        xy=(0.55, pass_55_30),
        xytext=(0.58, pass_55_30 - 1.5),
        arrowprops=dict(facecolor='black', shrink=0.08, width=1, headwidth=6),
        fontsize=10,
        fontweight='bold'
    )

    plt.title('Dense Semantic (Sentence-BERT) Pass Rate Sweep', fontsize=14, fontweight='bold', pad=15)
    plt.xlabel('Match Similarity Threshold (Cosine)', fontsize=12, labelpad=10)
    plt.ylabel('Passing Cases Count (out of 15)', fontsize=12, labelpad=10)
    plt.xlim(0.28, 0.92)
    plt.ylim(-0.5, 16)
    plt.grid(True, linestyle='--', alpha=0.5)
    plt.legend(fontsize=10, loc='lower left')
    
    plt.tight_layout()
    
    plt.savefig('dense_threshold_sweep.png', dpi=300)
    print("Successfully generated dense_threshold_sweep.png")

if __name__ == '__main__':
    sweep_dense_thresholds()
