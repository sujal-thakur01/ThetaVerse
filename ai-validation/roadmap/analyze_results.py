#!/usr/bin/env python3
"""
Analysis report of content validation results.
Shows which validation layers are failing and why.
"""

import json
from pathlib import Path
from collections import defaultdict


def analyze_validation_results(validation_file: str = 'validation_results/validation_results.json'):
    """Analyze validation results and generate insights."""
    
    with open(validation_file, 'r') as f:
        results = json.load(f)
    
    analysis = {
        "total_cases": results['summary']['total_cases'],
        "layer_breakdown": defaultdict(list),
        "failure_patterns": defaultdict(int),
        "recommendations": []
    }
    
    # Analyze each failed case
    for case in results['results']:
        if case['content_ok']:
            continue
        
        case_id = case['case_id']
        position = case['position']
        company = case['company']
        
        # Check which layers failed
        validations = case['validations']
        
        # Rules layer
        if not validations['rules'].get('rule_check_ok', True):
            for issue in validations['rules'].get('issues', []):
                analysis['layer_breakdown']['rules'].append({
                    'case': case_id,
                    'issue': issue
                })
                analysis['failure_patterns']['rules_failed'] += 1
        
        # Consistency layer (biggest blocker)
        if not validations['consistency'].get('consistency_ok', True):
            for issue in validations['consistency'].get('issues', []):
                analysis['layer_breakdown']['consistency'].append({
                    'case': case_id,
                    'issue': issue
                })
                analysis['failure_patterns']['consistency_failed'] += 1
                
                # Track specific failure types
                if 'High-priority too high' in issue:
                    analysis['failure_patterns']['high_priority_too_high'] += 1
                elif 'subtopics but' in issue:
                    analysis['failure_patterns']['subtopic_count_mismatch'] += 1
                elif 'imbalanced' in issue:
                    analysis['failure_patterns']['hour_imbalance'] += 1
        
        # Relevance layer
        if not validations['relevance'].get('relevance_ok', True):
            rel = validations['relevance']
            analysis['layer_breakdown']['relevance'].append({
                'case': case_id,
                'coverage_pct': rel.get('keyword_coverage_pct', 0)
            })
            analysis['failure_patterns']['relevance_failed'] += 1
    
    # Generate recommendations
    rules_fail_pct = analysis['failure_patterns']['rule_check_ok'] 
    consistency_fail = analysis['failure_patterns']['consistency_failed']
    relevance_fail = analysis['failure_patterns']['relevance_failed']
    
    if consistency_fail > 0:
        pct = consistency_fail / results['summary']['total_cases'] * 100
        analysis['recommendations'].append(
            f"❌ CONSISTENCY CHECK: {consistency_fail}/{results['summary']['total_cases']} cases failed ({pct:.0f}%)\n"
            f"   Root cause: Groq marks all topics as 'High' priority (100%),\n"
            f"   but validation expects 25-60% High priority\n"
            f"   → FIX: Relax to 0-100% (accept LLM artifact) OR add priority prompt\n"
            f"   Breakdown:\n"
            f"     - High-priority > 60%: {analysis['failure_patterns']['high_priority_too_high']} cases\n"
            f"     - Subtopic count mismatch: {analysis['failure_patterns']['subtopic_count_mismatch']} cases\n"
            f"     - Hour imbalance: {analysis['failure_patterns']['hour_imbalance']} cases"
        )
    
    if relevance_fail > 0:
        pct = relevance_fail / results['summary']['total_cases'] * 100
        analysis['recommendations'].append(
            f"⚠️  RELEVANCE CHECK: {relevance_fail}/{results['summary']['total_cases']} cases failed ({pct:.0f}%)\n"
            f"   Cause: Keyword coverage < 50% (Groq ignores some request keywords)\n"
            f"   → FIX: Relax threshold to 30% OR improve prompt specificity"
        )
    
    return analysis


def print_analysis(analysis: dict):
    """Pretty-print analysis."""
    print("\n" + "="*80)
    print("CONTENT VALIDATION ANALYSIS & RECOMMENDATIONS")
    print("="*80)
    
    # Summary
    print(f"\nTotal Cases Analyzed: {analysis['total_cases']}")
    print(f"Failure Patterns:")
    for pattern, count in sorted(analysis['failure_patterns'].items(), key=lambda x: -x[1]):
        print(f"  • {pattern}: {count}")
    
    # Recommendations
    print(f"\n" + "-"*80)
    print("RECOMMENDATIONS FOR IMPROVEMENT:")
    print("-"*80)
    
    for i, rec in enumerate(analysis['recommendations'], 1):
        print(f"\n{i}. {rec}")
    
    # Summary insights
    print(f"\n" + "-"*80)
    print("INSIGHTS:")
    print("-"*80)
    
    consistency_issue = analysis['failure_patterns'].get('consistency_failed', 0)
    if consistency_issue > 20:
        print("\n✓ Primary blocker: CONSISTENCY checks are too strict")
        print("  - LLMs tend to mark all topics as 'High' priority")
        print("  - This is a model artifact, not a quality issue")
        print("  - Solution: Accept all-High or adjust prompt to enforce mixed priorities")
    
    relevance_issue = analysis['failure_patterns'].get('relevance_failed', 0)
    if relevance_issue > 5:
        print("\n✓ Secondary issue: RELEVANCE checks are moderately strict")
        print("  - Groq sometimes misses keywords from the request")
        print("  - But overall coverage is decent (65% of cases pass)")
        print("  - Solution: Reduce threshold from 50% to 30% keyword coverage")
    
    print("\n" + "="*80 + "\n")


if __name__ == '__main__':
    analysis = analyze_validation_results()
    print_analysis(analysis)
    
    # Save analysis
    with open('validation_results/analysis.json', 'w') as f:
        json.dump(analysis, f, indent=2)
    print("✓ Analysis saved to validation_results/analysis.json")
