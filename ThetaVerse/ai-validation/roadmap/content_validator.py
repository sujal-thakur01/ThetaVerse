#!/usr/bin/env python3
"""
Content validation techniques for roadmap quality assessment.
Implements semantic, relevance, consistency, and comparison-based validation.
"""

import json
import re
import numpy as np
from typing import Any, Dict, List, Tuple
from pathlib import Path

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("⚠ scikit-learn not available; semantic similarity checks disabled")

import requests
import os
from dotenv import load_dotenv

load_dotenv()


class ContentValidator:
    """Comprehensive content validation for roadmap topics."""
    
    def __init__(self, golden_dataset_path: str = "golden_dataset.json"):
        self.golden_dataset = self._load_golden_dataset(golden_dataset_path)
    
    def _load_golden_dataset(self, path: str) -> dict | None:
        """Load golden dataset if available."""
        if not os.path.exists(path):
            return None
        try:
            with open(path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load golden dataset: {e}")
            return None
    
    # ========== LAYER 1: Rule-Based Content Validation ==========
    
    def validate_rules(self, topics: List[dict]) -> Dict[str, Any]:
        """Check topics against domain rules."""
        issues = []
        
        # Rule 1: Title length
        for i, topic in enumerate(topics):
            title = topic.get("title", "").strip()
            if len(title) < 5:
                issues.append(f"Topic {i}: title too short ('{title}')")
            if len(title) > 100:
                issues.append(f"Topic {i}: title too long ({len(title)} chars)")
        
        # Rule 2: Hours validity
        for i, topic in enumerate(topics):
            hours = topic.get("estimatedHours", 0)
            if hours <= 0:
                issues.append(f"Topic {i}: estimatedHours must be > 0 (got {hours})")
            if hours > 100:
                issues.append(f"Topic {i}: hours unrealistic (>{100}h)")
        
        # Rule 3: Subtopics quality
        for i, topic in enumerate(topics):
            subtopics = topic.get("subtopics", [])
            if len(subtopics) < 2:
                issues.append(f"Topic {i}: needs at least 2 subtopics (got {len(subtopics)})")
            for j, sub in enumerate(subtopics):
                if len(sub.strip()) < 3:
                    issues.append(f"Topic {i}, subtopic {j}: too short ('{sub}')")
        
        # Rule 4: Reference links
        for i, topic in enumerate(topics):
            links = topic.get("referenceLinks", [])
            if len(links) < 1:
                issues.append(f"Topic {i}: needs at least 1 referenceLink")
            for j, link in enumerate(links):
                if not self._is_valid_url(link):
                    issues.append(f"Topic {i}, link {j}: invalid URL ('{link}')")
        
        # Rule 5: Priority enum
        valid_priorities = {"High", "Medium", "Low"}
        for i, topic in enumerate(topics):
            priority = topic.get("priority")
            if priority and priority not in valid_priorities:
                issues.append(f"Topic {i}: invalid priority '{priority}'")
        
        return {
            "rule_check_ok": len(issues) == 0,
            "issues": issues,
            "issue_count": len(issues)
        }
    
    @staticmethod
    def _is_valid_url(url: str) -> bool:
        """Check if URL looks valid."""
        url_pattern = r'^https?://[^\s/$.?#].[^\s]*$'
        return bool(re.match(url_pattern, url))
    
    # ========== LAYER 2: Semantic Diversity (Duplicate Detection) ==========
    
    def check_semantic_diversity(self, topics: List[dict], threshold: float = 0.75) -> Dict[str, Any]:
        """Detect duplicate or near-duplicate topics."""
        if not SKLEARN_AVAILABLE or len(topics) < 2:
            return {"diversity_check_ok": True, "duplicates": [], "skipped": True}
        
        issues = []
        titles = [t.get("title", "") for t in topics]
        
        try:
            vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(2, 3))
            vectors = vectorizer.fit_transform(titles)
            similarities = cosine_similarity(vectors)
            
            # Find suspiciously similar topic pairs
            duplicates = []
            for i in range(len(titles)):
                for j in range(i + 1, len(titles)):
                    sim = float(similarities[i][j])
                    if sim > threshold:
                        duplicates.append({
                            "topic_i": i,
                            "topic_j": j,
                            "title_i": titles[i],
                            "title_j": titles[j],
                            "similarity": round(sim, 3)
                        })
                        issues.append(
                            f"Topics {i} & {j} too similar ({sim:.2%}): "
                            f"'{titles[i]}' vs '{titles[j]}'"
                        )
            
            return {
                "diversity_check_ok": len(duplicates) == 0,
                "duplicates": duplicates,
                "issue_count": len(issues)
            }
        except Exception as e:
            return {
                "diversity_check_ok": True,
                "error": str(e),
                "skipped": True
            }
    
    # ========== LAYER 3: Time-Fit Validation ==========
    
    def validate_time_fit(self, topics: List[dict], target_hours: float, tolerance_pct: float = 20) -> Dict[str, Any]:
        """Check if total hours fit budget."""
        total = sum(t.get("estimatedHours", 0) for t in topics)
        tolerance = target_hours * (tolerance_pct / 100)
        variance = total - target_hours
        
        return {
            "time_fit_ok": abs(variance) <= tolerance,
            "total_hours": total,
            "target_hours": target_hours,
            "variance": round(variance, 1),
            "variance_pct": round((variance / target_hours) * 100, 1) if target_hours > 0 else 0,
            "tolerance_pct": tolerance_pct
        }
    
    # ========== LAYER 4: Consistency Checks (Internal Logic) ==========
    
    def check_consistency(self, topics: List[dict]) -> Dict[str, Any]:
        """Check internal consistency of roadmap."""
        issues = []
        
        # Check 1: High-priority topics should have substantial hours
        high_priority_hours = [
            t.get("estimatedHours", 0) 
            for t in topics 
            if t.get("priority") == "High"
        ]
        if high_priority_hours:
            if np.mean(high_priority_hours) < 5:
                issues.append("High-priority topics have too few hours (< 5h avg)")
        
        # Check 2: High-priority should be ~25-60% of total
        total = sum(t.get("estimatedHours", 0) for t in topics)
        if total > 0:
            high_total = sum(high_priority_hours)
            high_pct = (high_total / total) * 100
            if high_pct < 25:
                issues.append(f"High-priority too low ({high_pct:.0f}% < 25%)")
            elif high_pct > 60:
                issues.append(f"High-priority too high ({high_pct:.0f}% > 60%)")
        
        # Check 3: Subtopic count should scale with hours
        for i, topic in enumerate(topics):
            hours = topic.get("estimatedHours", 0)
            subs = len(topic.get("subtopics", []))
            expected_min = max(2, int(hours / 5))
            if subs < expected_min:
                issues.append(
                    f"Topic {i}: {subs} subtopics but {hours}h suggests ≥{expected_min}"
                )
        
        # Check 4: Hour distribution should be somewhat balanced
        hours_list = [t.get("estimatedHours", 0) for t in topics]
        if hours_list:
            max_hours = max(hours_list)
            min_hours = min(hours_list)
            ratio = max_hours / min_hours if min_hours > 0 else float('inf')
            if ratio > 10:
                issues.append(
                    f"Hour distribution imbalanced: max/min ratio = {ratio:.1f} "
                    f"({max_hours}h vs {min_hours}h)"
                )
        
        return {
            "consistency_ok": len(issues) == 0,
            "issues": issues,
            "issue_count": len(issues)
        }
    
    # ========== LAYER 5: Relevance to Request ==========
    
    def check_relevance(self, topics: List[dict], position: str, company: str, major_topic: str) -> Dict[str, Any]:
        """Check if roadmap aligns with the request."""
        issues = []
        titles_combined = " ".join([t.get("title", "") for t in topics]).lower()
        
        # Extract keywords from request
        request_text = f"{position} {company} {major_topic}".lower()
        keywords = [w for w in request_text.split() if len(w) > 3]
        
        covered_keywords = []
        missing_keywords = []
        for keyword in keywords:
            if keyword in titles_combined:
                covered_keywords.append(keyword)
            else:
                missing_keywords.append(keyword)
        
        coverage_pct = len(covered_keywords) / len(keywords) * 100 if keywords else 100
        
        if coverage_pct < 50:
            issues.append(
                f"Low keyword coverage ({coverage_pct:.0f}%). "
                f"Missing: {missing_keywords[:3]}"
            )
        
        return {
            "relevance_ok": coverage_pct >= 50,
            "keyword_coverage_pct": round(coverage_pct, 1),
            "covered_keywords": covered_keywords,
            "missing_keywords": missing_keywords,
            "issues": issues
        }
    
    # ========== LAYER 6: Golden Dataset Comparison ==========
    
    def compare_with_golden(self, topics: List[dict], position: str, company: str) -> Dict[str, Any]:
        """Compare roadmap to golden references for same role/company."""
        if not self.golden_dataset:
            return {"comparison_ok": True, "skipped": True, "reason": "No golden dataset"}
        
        # Find matching golden references
        matching_refs = [
            ref for ref in self.golden_dataset['references']
            if ref['position'].lower() == position.lower() 
            and ref['company'].lower() == company.lower()
        ]
        
        if not matching_refs:
            return {
                "comparison_ok": True,
                "skipped": True,
                "reason": f"No golden references for {position} at {company}"
            }
        
        # Compare against best match (by topic count similarity)
        gen_titles = {t["title"].lower() for t in topics}
        
        comparison_results = []
        for ref in matching_refs:
            ref_titles = {t["title"].lower() for t in ref['topics']}
            
            coverage = len(gen_titles & ref_titles) / len(ref_titles) if ref_titles else 0
            drift = len(gen_titles - ref_titles) / len(gen_titles) if gen_titles else 0
            
            comparison_results.append({
                "reference_case": ref['case_id'],
                "coverage_pct": round(coverage * 100, 1),
                "drift_pct": round(drift * 100, 1),
                "shared_topics": list(gen_titles & ref_titles)[:5],
                "missing_topics": list(ref_titles - gen_titles)[:5],
                "extra_topics": list(gen_titles - ref_titles)[:5]
            })
        
        # Use best match (highest coverage)
        best = max(comparison_results, key=lambda x: x['coverage_pct'])
        
        return {
            "comparison_ok": best['coverage_pct'] >= 40,
            "best_match": best,
            "all_comparisons": comparison_results,
            "num_golden_refs": len(matching_refs)
        }
    
    # ========== LAYER 7: LLM-as-Judge (Optional, requires API key) ==========
    
    def score_with_llm(self, topics: List[dict], position: str, company: str) -> Dict[str, Any]:
        """Have LLM rate the roadmap quality."""
        api_key = os.getenv('GROQ_API_KEY')
        if not api_key:
            return {"llm_score_ok": True, "skipped": True, "reason": "No GROQ_API_KEY"}
        
        # Format topics for LLM
        topics_text = "\n".join([
            f"- {t['title']} ({t['estimatedHours']}h): {', '.join(t.get('subtopics', [])[:3])}"
            for t in topics[:5]  # Limit to first 5 for brevity
        ])
        
        prompt = f"""Rate this learning roadmap for a {position} at {company} (1-10 scale):

{topics_text}

Respond with ONLY valid JSON (no markdown):
{{
  "relevance_score": <int 1-10>,
  "completeness_score": <int 1-10>,
  "progression_score": <int 1-10>,
  "realism_score": <int 1-10>,
  "overall_score": <int 1-10>,
  "feedback": "<one sentence>"
}}"""
        
        try:
            payload = {
                "model": "openai/gpt-oss-20b",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
                "max_tokens": 300,
            }
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            content = response.json()["choices"][0]["message"]["content"]
            # Extract JSON
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                score_data = json.loads(content[start:end])
                return {
                    "llm_score_ok": True,
                    "scores": score_data,
                    "overall_score": score_data.get("overall_score", 0)
                }
        except Exception as e:
            return {
                "llm_score_ok": False,
                "error": str(e)
            }
        
        return {"llm_score_ok": False, "error": "Failed to parse LLM response"}
    
    # ========== INTEGRATION: Full Content Validation ==========
    
    def validate_all(self, topics: List[dict], case_info: dict) -> Dict[str, Any]:
        """Run all validation layers and return comprehensive report."""
        position = case_info.get('position', '')
        company = case_info.get('company', '')
        major_topic = case_info.get('majorTopic', '')
        target_hours = case_info.get('days', 0) * case_info.get('hoursPerDay', 0)
        
        results = {
            "case_id": case_info.get('case_id', 'unknown'),
            "position": position,
            "company": company,
            "validations": {}
        }
        
        # Layer 1: Rules
        results['validations']['rules'] = self.validate_rules(topics)
        
        # Layer 2: Semantic Diversity
        results['validations']['diversity'] = self.check_semantic_diversity(topics)
        
        # Layer 3: Time-Fit
        results['validations']['time_fit'] = self.validate_time_fit(topics, target_hours)
        
        # Layer 4: Consistency
        results['validations']['consistency'] = self.check_consistency(topics)
        
        # Layer 5: Relevance
        results['validations']['relevance'] = self.check_relevance(
            topics, position, company, major_topic
        )
        
        # Layer 6: Golden Comparison
        results['validations']['golden_comparison'] = self.compare_with_golden(
            topics, position, company
        )
        
        # Layer 7: LLM Score (optional, skip by default)
        # results['validations']['llm_judge'] = self.score_with_llm(topics, position, company)
        
        # Overall pass/fail
        required_checks = ['rules', 'diversity', 'time_fit', 'consistency', 'relevance']
        results['content_ok'] = all(
            results['validations'][check].get(
                [k for k in results['validations'][check].keys() if k.endswith('_ok')][0], 
                True
            )
            for check in required_checks
        )
        
        return results


def format_validation_report(validation_result: Dict[str, Any]) -> str:
    """Format validation results as readable report."""
    lines = [
        f"\n{'='*60}",
        f"Content Validation Report: {validation_result['case_id']}",
        f"{validation_result['position']} @ {validation_result['company']}",
        f"{'='*60}",
    ]
    
    validations = validation_result['validations']
    
    # Summary
    lines.append(f"\n✓ OVERALL: {'PASS' if validation_result['content_ok'] else 'FAIL'}")
    
    # Rules
    rules = validations['rules']
    lines.append(f"\n[Rules] {'✓' if rules['rule_check_ok'] else '✗'} ({rules['issue_count']} issues)")
    for issue in rules['issues'][:3]:
        lines.append(f"  • {issue}")
    
    # Diversity
    diversity = validations['diversity']
    lines.append(f"\n[Diversity] {'✓' if diversity.get('diversity_check_ok', True) else '✗'}")
    if diversity.get('duplicates'):
        for dup in diversity['duplicates'][:2]:
            lines.append(f"  • Similar: {dup['title_i']} ↔ {dup['title_j']} ({dup['similarity']})")
    
    # Time-fit
    tf = validations['time_fit']
    lines.append(f"\n[Time-Fit] {'✓' if tf['time_fit_ok'] else '✗'}")
    lines.append(f"  • Total: {tf['total_hours']}h / Target: {tf['target_hours']}h ({tf['variance_pct']:+.0f}%)")
    
    # Consistency
    cons = validations['consistency']
    lines.append(f"\n[Consistency] {'✓' if cons['consistency_ok'] else '✗'} ({cons['issue_count']} issues)")
    for issue in cons['issues'][:2]:
        lines.append(f"  • {issue}")
    
    # Relevance
    rel = validations['relevance']
    lines.append(f"\n[Relevance] {'✓' if rel['relevance_ok'] else '✗'} ({rel['keyword_coverage_pct']:.0f}% keyword coverage)")
    
    # Golden Comparison
    golden = validations['golden_comparison']
    if not golden.get('skipped'):
        best = golden.get('best_match', {})
        lines.append(f"\n[Golden Comparison] {'✓' if golden['comparison_ok'] else '✗'}")
        lines.append(f"  • Coverage: {best.get('coverage_pct', 0):.0f}% (vs {golden['num_golden_refs']} refs)")
    
    lines.append(f"\n{'='*60}\n")
    return "\n".join(lines)


if __name__ == '__main__':
    # Example usage
    validator = ContentValidator()
    print("✓ Content validator initialized")
    print(f"  Golden dataset loaded: {validator.golden_dataset is not None}")
