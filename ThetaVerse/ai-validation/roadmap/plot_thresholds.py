import os
import json
import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, List, Any

# Ensure we can import from the current directory
import sys
sys.path.append(os.getcwd())

from content_validator_pydantic import ContentValidatorPydantic
from run_pydantic_validation import load_manifest, load_case_response, extract_roadmap_topics

def sweep_thresholds(
    manifest_path: str = 'runs_pydantic/manifest_pydantic.json',
    golden_path: str = 'golden_dataset_15.json'
):
    # 1. Load resources
    manifest = load_manifest(manifest_path)
    validator = ContentValidatorPydantic(golden_path)
    
    # Pre-load all responses and topics
    cases_data = []
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
        case_info['case_id'] = case_id
        
        cases_data.append((topics, case_info))

    # 2. Define sweeps
    match_thresholds = np.arange(0.20, 0.81, 0.05)
    coverage_thresholds = [15.0, 30.0, 40.0, 50.0]
    
    # Store results: coverage_threshold -> list of pass counts (one per match_threshold)
    sweep_results = {cov: [] for cov in coverage_thresholds}
    
    for cov_thresh in coverage_thresholds:
        for match_thresh in match_thresholds:
            pass_count = 0
            
            for topics, case_info in cases_data:
                # We validate only the Golden Comparison layer under these settings
                res = validator.compare_with_golden(
                    topics=topics,
                    position=case_info['position'],
                    company=case_info['company'],
                    match_threshold=match_thresh
                )
                
                # Check if this case passes under the current coverage threshold
                # (res['coverage_pct'] is the actual coverage calculated)
                coverage_pct = res.get('coverage_pct', 0.0)
                if coverage_pct >= cov_thresh:
                    pass_count += 1
            
            sweep_results[cov_thresh].append(pass_count)

    # 3. Plotting
    plt.figure(figsize=(10, 6))
    
    # Premium style colors
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
        
    # Highlighting our selected calibration point: Match Thresh 0.45, Coverage 15%
    # We find the index of 0.45 in match_thresholds
    idx_45 = np.where(np.isclose(match_thresholds, 0.45))[0][0]
    pass_45_15 = sweep_results[15.0][idx_45]
    
    plt.plot(
        0.45, pass_45_15, 
        marker='*', 
        color='#e53935', 
        markersize=14, 
        label='Selected Calibration (0.45 Sim, 15% Cov)',
        linestyle='None'
    )
    
    plt.annotate(
        f'Calibrated Point ({pass_45_15}/15 Pass)',
        xy=(0.45, pass_45_15),
        xytext=(0.48, pass_45_15 - 1.5),
        arrowprops=dict(facecolor='black', shrink=0.08, width=1, headwidth=6),
        fontsize=10,
        fontweight='bold'
    )

    plt.title('Validation Pass Rate Sensitivity Sweep', fontsize=14, fontweight='bold', pad=15)
    plt.xlabel('Match Similarity Threshold (Cosine)', fontsize=12, labelpad=10)
    plt.ylabel('Passing Cases Count (out of 15)', fontsize=12, labelpad=10)
    plt.xlim(0.18, 0.82)
    plt.ylim(-0.5, 16)
    plt.grid(True, linestyle='--', alpha=0.5)
    plt.legend(fontsize=10, loc='lower left')
    
    plt.tight_layout()
    
    # Save the output plot
    plt.savefig('threshold_sweep.png', dpi=300)
    print("Successfully generated threshold_sweep.png")

if __name__ == '__main__':
    sweep_thresholds()
