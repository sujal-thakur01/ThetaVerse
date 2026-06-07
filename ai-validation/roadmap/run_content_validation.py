#!/usr/bin/env python3
"""
Integrated content validation runner.
1. Builds golden dataset from passing cases
2. Runs all 40 cases through content validation pipeline
3. Generates comprehensive validation report
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any
import argparse

from content_validator import ContentValidator, format_validation_report


def load_manifest(manifest_path: str) -> dict:
    """Load validation manifest."""
    with open(manifest_path, 'r') as f:
        return json.load(f)


def load_case_response(response_file: str) -> dict | None:
    """Load a case response file."""
    try:
        with open(response_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Could not load {response_file}: {e}")
        return None


def extract_roadmap_topics(response_data: dict) -> List[dict] | None:
    """Extract roadmap topics from response."""
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
    except Exception:
        return None


def run_content_validation(
    manifest_path: str = 'runs/manifest.json',
    golden_dataset_path: str = 'golden_dataset.json',
    output_dir: str = 'validation_results',
    verbose: bool = False
) -> Dict[str, Any]:
    """Run content validation on all cases."""
    
    # Load manifest
    manifest = load_manifest(manifest_path)
    
    # Initialize validator
    validator = ContentValidator(golden_dataset_path)
    
    # Create output directory
    Path(output_dir).mkdir(exist_ok=True)
    
    results = {
        "run_timestamp": manifest['run_started'],
        "validator_version": "1.0",
        "total_cases": len(manifest['results']),
        "results": [],
        "summary": {
            "total_cases": 0,
            "schema_passed": 0,
            "content_passed": 0,
            "both_passed": 0,
            "by_validation_layer": {}
        }
    }
    
    # Process each case
    for i, case_result in enumerate(manifest['results'], 1):
        case_id = case_result['case_id']
        response_file = case_result['response_file']
        
        # Load response
        response_data = load_case_response(response_file)
        if not response_data:
            continue
        
        # Extract topics
        topics = extract_roadmap_topics(response_data)
        if topics is None:
            continue
        
        # Extract case info
        case_info = response_data.get('meta', {}).get('case', {})
        case_info['case_id'] = case_id
        
        # Run content validation
        validation_result = validator.validate_all(topics, case_info)
        
        # Add schema validation result
        validation_result['schema_ok'] = case_result['ok']
        validation_result['parse_ok'] = case_result['parse_ok']
        validation_result['num_topics'] = len(topics)
        
        results['results'].append(validation_result)
        
        # Update summary
        results['summary']['total_cases'] += 1
        if case_result['ok']:
            results['summary']['schema_passed'] += 1
        if validation_result['content_ok']:
            results['summary']['content_passed'] += 1
        if case_result['ok'] and validation_result['content_ok']:
            results['summary']['both_passed'] += 1
        
        # Print progress
        status = "✓" if validation_result['content_ok'] else "✗"
        position = case_info.get('position', 'Unknown')
        company = case_info.get('company', 'Unknown')
        print(f"[{i:02d}/{len(manifest['results'])}] {case_id}: {status} "
              f"({position} @ {company})")
        
        if verbose and not validation_result['content_ok']:
            print(format_validation_report(validation_result))
    
    # Calculate layer statistics
    layer_stats = {
        'rules': {'pass': 0, 'fail': 0},
        'diversity': {'pass': 0, 'fail': 0},
        'time_fit': {'pass': 0, 'fail': 0},
        'consistency': {'pass': 0, 'fail': 0},
        'relevance': {'pass': 0, 'fail': 0},
        'golden_comparison': {'pass': 0, 'fail': 0},
    }
    
    for res in results['results']:
        for layer in layer_stats.keys():
            if layer in res['validations']:
                ok_key = [k for k in res['validations'][layer].keys() if k.endswith('_ok')]
                if ok_key:
                    is_ok = res['validations'][layer].get(ok_key[0], True)
                    layer_stats[layer]['pass' if is_ok else 'fail'] += 1
    
    results['summary']['by_validation_layer'] = layer_stats
    
    # Save results
    output_file = f"{output_dir}/validation_results.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n✓ Validation results saved to: {output_file}")
    
    return results


def print_summary(results: Dict[str, Any]):
    """Print validation summary."""
    summary = results['summary']
    
    print("\n" + "="*70)
    print("CONTENT VALIDATION SUMMARY")
    print("="*70)
    print(f"\nTotal Cases:           {summary['total_cases']}")
    print(f"Schema Valid:          {summary['schema_passed']}/{summary['total_cases']} "
          f"({summary['schema_passed']/summary['total_cases']*100:.0f}%)")
    print(f"Content Valid:         {summary['content_passed']}/{summary['total_cases']} "
          f"({summary['content_passed']/summary['total_cases']*100:.0f}%)")
    print(f"Both Valid:            {summary['both_passed']}/{summary['total_cases']} "
          f"({summary['both_passed']/summary['total_cases']*100:.0f}%)")
    
    print(f"\nValidation Layer Results:")
    for layer, stats in summary['by_validation_layer'].items():
        total = stats['pass'] + stats['fail']
        if total > 0:
            pass_pct = stats['pass'] / total * 100
            print(f"  {layer:20s}: {stats['pass']:2d}/{total:2d} ({pass_pct:5.1f}%)")
    
    print("="*70 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Run comprehensive content validation on roadmap cases'
    )
    parser.add_argument(
        '--manifest',
        default='runs/manifest.json',
        help='Path to validation manifest'
    )
    parser.add_argument(
        '--golden',
        default='golden_dataset.json',
        help='Path to golden dataset'
    )
    parser.add_argument(
        '--output',
        default='validation_results',
        help='Output directory for results'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Print detailed reports for failed cases'
    )
    parser.add_argument(
        '--build-golden',
        action='store_true',
        help='Build golden dataset before validation'
    )
    
    args = parser.parse_args()
    
    # Build golden dataset if requested
    if args.build_golden:
        print("Building golden dataset from passing cases...")
        from build_golden_dataset import build_golden_dataset
        golden = build_golden_dataset()
        print(f"✓ Golden dataset ready: {golden['passing_cases']} cases\n")
    
    # Run validation
    print("Running content validation on all cases...\n")
    results = run_content_validation(
        manifest_path=args.manifest,
        golden_dataset_path=args.golden,
        output_dir=args.output,
        verbose=args.verbose
    )
    
    # Print summary
    print_summary(results)
    
    # Print sample failures if verbose
    if args.verbose and results['summary']['content_passed'] < results['summary']['total_cases']:
        print("\nSample Failed Cases (showing first 3):\n")
        failed = [r for r in results['results'] if not r['content_ok']]
        for res in failed[:3]:
            print(format_validation_report(res))


if __name__ == '__main__':
    main()
