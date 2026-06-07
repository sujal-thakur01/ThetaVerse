#!/usr/bin/env python3
"""
Integration runner for Pydantic V2 roadmap content validation.
Loads evaluation results, performs similarity search & heuristics validation,
and prints a safe summary report.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any

from content_validator_pydantic import ContentValidatorPydantic


def safe_print(text: str, *args, **kwargs):
    """Print text safely, encoding characters when the terminal doesn't support them."""
    try:
        print(text, *args, **kwargs)
    except UnicodeEncodeError:
        encoding = sys.stdout.encoding or 'ascii'
        encoded = text.encode(encoding, errors='replace')
        print(encoded.decode(encoding), *args, **kwargs)


def load_manifest(manifest_path: str) -> dict:
    """Load validation manifest."""
    with open(manifest_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_case_response(response_file: str) -> dict | None:
    """Load a case response file."""
    try:
        with open(response_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        safe_print(f"Warning: Could not load {response_file}: {e}")
        return None


def extract_roadmap_topics(response_data: dict) -> List[dict] | None:
    """Extract roadmap topics from response."""
    try:
        if not response_data:
            return None
        # Support both parsed structures and raw content parsing
        if 'parsed' in response_data:
            return response_data['parsed'].get('topics', [])
        elif 'raw' in response_data:
            content = response_data['raw'].get('content', '')
            parsed = json.loads(content)
            return parsed.get('topics', [])
        return None
    except Exception:
        return None


def format_report_lines(validation_result: Dict[str, Any]) -> List[str]:
    """Format validation results as readable report lines."""
    lines = [
        "=" * 60,
        f"Validation Report: {validation_result['case_id']}",
        f"{validation_result['position']} @ {validation_result['company']}",
        "=" * 60,
    ]
    
    validations = validation_result['validations']
    
    # Summary
    lines.append(f"OVERALL STATUS: {'PASS' if validation_result['content_ok'] else 'FAIL'}")
    
    # Rules
    rules = validations.get('rules', {})
    lines.append(f"[Rules] {'PASS' if rules.get('rule_check_ok') else 'FAIL'} ({rules.get('issue_count', 0)} issues)")
    for issue in rules.get('issues', [])[:3]:
        lines.append(f"  * {issue}")
    
    # Diversity
    diversity = validations.get('diversity', {})
    lines.append(f"[Diversity] {'PASS' if diversity.get('diversity_check_ok') else 'FAIL'}")
    for issue in diversity.get('issues', [])[:2]:
        lines.append(f"  * {issue}")
    
    # Time-fit
    tf = validations.get('time_fit', {})
    lines.append(f"[Time-Fit] {'PASS' if tf.get('time_fit_ok') else 'FAIL'} (Total: {tf.get('total_hours')}h / Target: {tf.get('target_hours')}h)")
    
    # Consistency
    cons = validations.get('consistency', {})
    lines.append(f"[Consistency] {'PASS' if cons.get('consistency_ok') else 'FAIL'} ({cons.get('issue_count', 0)} issues)")
    for issue in cons.get('issues', [])[:2]:
        lines.append(f"  * {issue}")
    
    # Relevance
    rel = validations.get('relevance', {})
    lines.append(f"[Relevance] {'PASS' if rel.get('relevance_ok') else 'FAIL'} ({rel.get('keyword_coverage_pct', 0)}% keyword coverage)")
    
    # Golden Comparison
    golden = validations.get('golden_comparison', {})
    if not golden.get('skipped'):
        lines.append(f"[Similarity search] {'PASS' if golden.get('comparison_ok') else 'FAIL'} (Coverage: {golden.get('coverage_pct')}% vs Reference)")
        
    lines.append("=" * 60)
    return lines


def run_validation(
    manifest_path: str = 'runs_pydantic/manifest_pydantic.json',
    golden_dataset_path: str = 'golden_dataset_15.json',
    output_dir: str = 'runs_pydantic',
    verbose: bool = False
) -> Dict[str, Any]:
    """Run validation across all manifest cases."""
    manifest = load_manifest(manifest_path)
    validator = ContentValidatorPydantic(golden_dataset_path)
    
    results = {
        "run_timestamp": manifest['run_started'],
        "total_cases": len(manifest['results']),
        "results": [],
        "summary": {
            "total_cases": 0,
            "schema_passed": 0,
            "content_passed": 0,
            "both_passed": 0,
            "by_layer": {
                "rules": 0,
                "diversity": 0,
                "time_fit": 0,
                "consistency": 0,
                "relevance": 0,
                "golden_comparison": 0
            }
        }
    }
    
    for i, case_result in enumerate(manifest['results'], 1):
        case_id = case_result['case_id']
        response_file = case_result['response_file']
        
        # Load output file
        response_data = load_case_response(response_file)
        if not response_data:
            continue
            
        topics = extract_roadmap_topics(response_data)
        if topics is None:
            safe_print(f"[{i:02d}] {case_id}: Could not extract topics")
            continue
            
        case_info = response_data.get('meta', {}).get('case', {})
        case_info['case_id'] = case_id
        
        # Validate
        validation_result = validator.validate_all(topics, case_info)
        validation_result['schema_ok'] = case_result['schema_ok']
        
        results['results'].append(validation_result)
        results['summary']['total_cases'] += 1
        
        if case_result['schema_ok']:
            results['summary']['schema_passed'] += 1
        if validation_result['content_ok']:
            results['summary']['content_passed'] += 1
        if case_result['schema_ok'] and validation_result['content_ok']:
            results['summary']['both_passed'] += 1
            
        # Update layer stats
        for layer in results['summary']['by_layer'].keys():
            layer_res = validation_result['validations'].get(layer, {})
            ok_key = [k for k in layer_res.keys() if k.endswith('_ok')]
            if ok_key and layer_res.get(ok_key[0], True):
                results['summary']['by_layer'][layer] += 1
                
        status_str = "PASS" if validation_result['content_ok'] else "FAIL"
        safe_print(f"[{i:02d}/15] {case_id}: {status_str} ({case_info.get('position')} @ {case_info.get('company')})")
        
        if verbose or not validation_result['content_ok']:
            report_lines = format_report_lines(validation_result)
            for line in report_lines:
                safe_print(line)
                
    # Save final validation results
    output_file = f"{output_dir}/validation_results_pydantic.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
        
    safe_print(f"\nSaved validation results to {output_file}")
    
    # Print high level summary
    safe_print("\n" + "=" * 60)
    safe_print("ROADMAP VALIDATION PIPELINE SUMMARY")
    safe_print("=" * 60)
    total = results['summary']['total_cases']
    safe_print(f"Total Cases Checked:  {total}")
    safe_print(f"Schema Valid:         {results['summary']['schema_passed']}/{total} ({results['summary']['schema_passed']/total*100:.1f}%)")
    safe_print(f"Content Valid:        {results['summary']['content_passed']}/{total} ({results['summary']['content_passed']/total*100:.1f}%)")
    safe_print(f"Fully Passing (Both): {results['summary']['both_passed']}/{total} ({results['summary']['both_passed']/total*100:.1f}%)")
    
    safe_print("\nLayer Success Rates:")
    for layer, passed in results['summary']['by_layer'].items():
        safe_print(f"  * {layer:20s}: {passed}/{total} ({passed/total*100:.1f}%)")
    safe_print("=" * 60 + "\n")
    
    return results


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Pydantic V2 roadmap content validation runner.")
    parser.add_argument('--manifest', default='runs_pydantic/manifest_pydantic.json', help='Path to manifest JSON')
    parser.add_argument('--golden', default='golden_dataset_15.json', help='Path to golden reference dataset')
    parser.add_argument('--out', default='runs_pydantic', help='Output directory for validation results')
    parser.add_argument('--verbose', action='store_true', help='Verbose reporting for all cases')
    args = parser.parse_args()
    
    run_validation(
        manifest_path=args.manifest,
        golden_dataset_path=args.golden,
        output_dir=args.out,
        verbose=args.verbose
    )
