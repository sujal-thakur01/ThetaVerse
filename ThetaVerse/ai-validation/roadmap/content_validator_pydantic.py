#!/usr/bin/env python3
"""
Content validator using Pydantic V2, TF-IDF cosine similarity search,
and calibrated heuristics to validate generated roadmaps.
"""

import json
import re
import os
from typing import Dict, List, Any
import numpy as np

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class ContentValidatorPydantic:
    """Validator using Pydantic validation, similarity search, and calibrated heuristics."""

    def __init__(self, golden_dataset_path: str = "golden_dataset_15.json"):
        self.golden_dataset = self._load_golden_dataset(golden_dataset_path)

    def _load_golden_dataset(self, path: str) -> dict | None:
        """Load golden dataset if available."""
        if not os.path.exists(path):
            return None
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load golden dataset: {e}")
            return None

    # ========== LAYER 1: Pydantic & Basic Rules ==========

    def validate_rules(self, topics: List[dict]) -> Dict[str, Any]:
        """Check basic rules (fallback/complement to Pydantic)."""
        issues = []
        for i, topic in enumerate(topics):
            title = topic.get("title", "").strip()
            if len(title) < 5 or len(title) > 150:
                issues.append(f"Topic {i}: title length must be 5-150 (got {len(title)})")

            hours = topic.get("estimatedHours", 0)
            if hours <= 0 or hours > 200:
                issues.append(f"Topic {i}: estimatedHours must be between 0 and 200 (got {hours})")

            priority = topic.get("priority", "")
            if priority not in ["High", "Medium", "Low"]:
                issues.append(f"Topic {i}: priority must be High, Medium, or Low (got '{priority}')")

            subtopics = topic.get("subtopics", [])
            if len(subtopics) < 2:
                issues.append(f"Topic {i}: needs at least 2 subtopics (got {len(subtopics)})")
            for j, sub in enumerate(subtopics):
                if not isinstance(sub, str) or len(sub.strip()) < 2:
                    issues.append(f"Topic {i}, subtopic {j}: too short ('{sub}')")

            links = topic.get("referenceLinks", [])
            if len(links) < 1:
                issues.append(f"Topic {i}: needs at least 1 reference link")
            for j, link in enumerate(links):
                if not link.startswith(('http://', 'https://')):
                    issues.append(f"Topic {i}, link {j}: invalid URL ('{link}')")

        return {
            "rule_check_ok": len(issues) == 0,
            "issues": issues,
            "issue_count": len(issues)
        }

    # ========== LAYER 2: Semantic Diversity (No Duplicates) ==========

    def check_semantic_diversity(self, topics: List[dict], threshold: float = 0.70) -> Dict[str, Any]:
        """Detect duplicate or near-duplicate topics within the generated roadmap."""
        if len(topics) < 2:
            return {"diversity_check_ok": True, "duplicates": [], "issue_count": 0}

        titles = [t.get("title", "").strip().lower() for t in topics]
        duplicates = []
        issues = []

        if SKLEARN_AVAILABLE:
            try:
                vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(2, 3))
                vectors = vectorizer.fit_transform(titles)
                similarities = cosine_similarity(vectors)

                for i in range(len(titles)):
                    for j in range(i + 1, len(titles)):
                        sim = float(similarities[i][j])
                        if sim > threshold:
                            duplicates.append({
                                "topic_i": i,
                                "topic_j": j,
                                "title_i": topics[i]["title"],
                                "title_j": topics[j]["title"],
                                "similarity": round(sim, 3)
                            })
                            issues.append(
                                f"Topics {i} & {j} are too similar ({sim:.2%}): "
                                f"'{topics[i]['title']}' vs '{topics[j]['title']}'"
                            )
            except Exception as e:
                # Fallback to Jaccard
                return self._check_diversity_jaccard(topics, threshold)
        else:
            return self._check_diversity_jaccard(topics, threshold)

        return {
            "diversity_check_ok": len(duplicates) == 0,
            "duplicates": duplicates,
            "issue_count": len(issues),
            "issues": issues
        }

    def _check_diversity_jaccard(self, topics: List[dict], threshold: float) -> Dict[str, Any]:
        duplicates = []
        issues = []
        for i in range(len(topics)):
            for j in range(i + 1, len(topics)):
                a_tokens = set(re.findall(r"[a-z0-9]+", topics[i].get("title", "").lower()))
                b_tokens = set(re.findall(r"[a-z0-9]+", topics[j].get("title", "").lower()))
                sim = len(a_tokens & b_tokens) / len(a_tokens | b_tokens) if (a_tokens or b_tokens) else 0.0
                if sim > threshold:
                    duplicates.append({
                        "topic_i": i,
                        "topic_j": j,
                        "title_i": topics[i]["title"],
                        "title_j": topics[j]["title"],
                        "similarity": round(sim, 3)
                    })
                    issues.append(f"Topics {i} & {j} too similar Jaccard ({sim:.2%})")
        return {
            "diversity_check_ok": len(duplicates) == 0,
            "duplicates": duplicates,
            "issue_count": len(issues),
            "issues": issues
        }

    # ========== LAYER 3: Time-Fit Validation ==========

    def validate_time_fit(self, topics: List[dict], target_hours: float, tolerance_pct: float = 20.0) -> Dict[str, Any]:
        """Check if total hours fit the target budget (±20% tolerance)."""
        total = sum(t.get("estimatedHours", 0) for t in topics)
        tolerance = target_hours * (tolerance_pct / 100.0)
        variance = total - target_hours
        
        return {
            "time_fit_ok": abs(variance) <= tolerance,
            "total_hours": total,
            "target_hours": target_hours,
            "variance": round(variance, 1),
            "variance_pct": round((variance / target_hours) * 100, 1) if target_hours > 0 else 0,
            "tolerance_pct": tolerance_pct
        }

    # ========== LAYER 4: Calibrated Consistency (Internal Logic) ==========

    def check_consistency(self, topics: List[dict]) -> Dict[str, Any]:
        """Check internal consistency with realistic thresholds."""
        issues = []
        
        # Rule 1: High-priority topics should have substantial hours (>3h average)
        high_priority_hours = [
            t.get("estimatedHours", 0) 
            for t in topics 
            if t.get("priority") == "High"
        ]
        if high_priority_hours:
            if np.mean(high_priority_hours) < 3.0:
                issues.append("High-priority topics have too few hours (< 3h avg)")
        
        # Rule 2: Subtopics count should be reasonable (at least 1 subtopic for any topic)
        for i, topic in enumerate(topics):
            subs = len(topic.get("subtopics", []))
            if subs < 1:
                issues.append(f"Topic {i}: needs at least 1 subtopic")
        
        # Rule 3: Hour distribution balance (max/min <= 20x ratio, only if varied)
        hours_list = [t.get("estimatedHours", 0) for t in topics]
        if hours_list and len(set(hours_list)) > 1:
            max_hours = max(hours_list)
            min_hours = min(hours_list)
            if min_hours > 0:
                ratio = max_hours / min_hours
                if ratio > 20.0:
                    issues.append(f"Hour distribution imbalanced: max/min = {ratio:.1f} ({max_hours}h vs {min_hours}h)")

        return {
            "consistency_ok": len(issues) == 0,
            "issues": issues,
            "issue_count": len(issues)
        }
    # ========== LAYER 5: Relevance to Request ==========

    def check_relevance(self, topics: List[dict], position: str, company: str, major_topic: str) -> Dict[str, Any]:
        """Check relevance with realistic keyword matching (>= 30% coverage)."""
        issues = []
        titles_combined = " ".join([t.get("title", "") for t in topics]).lower()
        subtopics_combined = " ".join([" ".join(t.get("subtopics", [])) for t in topics]).lower()
        search_corpus = f"{titles_combined} {subtopics_combined}"
        
        # We check relevance primarily against educational content (major_topic)
        request_text = major_topic.lower()
        words = re.findall(r"[a-z0-9]{4,}", request_text)
        
        STOP_WORDS = {
            'engineer', 'developer', 'junior', 'senior', 'staff', 'lead', 'startup', 
            'associate', 'intern', 'position', 'company', 'fundamentals', 'development'
        }
        
        keywords = [w for w in set(words) if w not in STOP_WORDS]
        if not keywords:
            # Fallback to general words if major_topic is too short
            request_text = f"{position} {company} {major_topic}".lower()
            words = re.findall(r"[a-z0-9]{4,}", request_text)
            keywords = [w for w in set(words) if w not in STOP_WORDS]
            
        covered_keywords = []
        missing_keywords = []
        
        for keyword in keywords:
            # Check flex-matching (e.g. "manipulation" matches "manipulating" by checking first 4 chars prefix)
            found = False
            for corpus_word in re.findall(r"[a-z0-9]{4,}", search_corpus):
                if corpus_word.startswith(keyword[:4]) or keyword.startswith(corpus_word[:4]):
                    found = True
                    break
            if found or keyword in search_corpus:
                covered_keywords.append(keyword)
            else:
                missing_keywords.append(keyword)
        
        coverage_pct = len(covered_keywords) / len(keywords) * 100 if keywords else 100
        
        # Calibrated threshold: 30%
        if coverage_pct < 30.0:
            issues.append(f"Low keyword coverage ({coverage_pct:.0f}%). Missing: {missing_keywords[:3]}")
        
        return {
            "relevance_ok": coverage_pct >= 30.0,
            "keyword_coverage_pct": round(coverage_pct, 1),
            "covered_keywords": covered_keywords,
            "missing_keywords": missing_keywords,
            "issues": issues
        }

    # ========== LAYER 6: Golden Dataset Comparison via Similarity Search ==========

    def compare_with_golden(self, topics: List[dict], position: str, company: str, match_threshold: float = 0.45) -> Dict[str, Any]:
        """Compare generated topics with golden reference using TF-IDF similarity search on titles + subtopics."""
        if not self.golden_dataset:
            return {"comparison_ok": True, "skipped": True, "reason": "No golden dataset"}
        
        # Find matching golden reference
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
        
        # Use first matching reference
        ref = matching_refs[0]
        
        # Rich text representations combining title + subtopics
        gen_texts = [t["title"].strip() + " " + " ".join(t.get("subtopics", [])) for t in topics]
        ref_texts = [t["title"].strip() + " " + " ".join(t.get("subtopics", [])) for t in ref['topics']]
        
        ref_titles = [t["title"].strip() for t in ref['topics']]
        matches = []
        unmatched_ref_titles = list(ref_titles)
        
        if SKLEARN_AVAILABLE and len(gen_texts) > 0 and len(ref_texts) > 0:
            try:
                # Combine both to fit vectorizer
                all_texts = gen_texts + ref_texts
                vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(2, 3))
                vectorizer.fit(all_texts)
                
                gen_vectors = vectorizer.transform(gen_texts)
                ref_vectors = vectorizer.transform(ref_texts)
                
                sim_matrix = cosine_similarity(gen_vectors, ref_vectors)
                
                # For each generated topic, find the best matching reference topic
                for i, gen_text in enumerate(gen_texts):
                    best_match_idx = int(np.argmax(sim_matrix[i]))
                    best_sim = float(sim_matrix[i][best_match_idx])
                    
                    if best_sim >= match_threshold:
                        ref_title = ref_titles[best_match_idx]
                        matches.append({
                            "generated": topics[i]["title"],
                            "reference": ref_title,
                            "similarity": round(best_sim, 3)
                        })
                        if ref_title in unmatched_ref_titles:
                            unmatched_ref_titles.remove(ref_title)
            except Exception as e:
                # Fallback to Jaccard mapping
                self._compare_jaccard(gen_texts, ref_texts, topics, ref['topics'], match_threshold, matches, unmatched_ref_titles)
        else:
            self._compare_jaccard(gen_texts, ref_texts, topics, ref['topics'], match_threshold, matches, unmatched_ref_titles)
            
        # Coverage metric: percentage of reference topics that were matched
        coverage_pct = (len(ref_titles) - len(unmatched_ref_titles)) / len(ref_titles) * 100 if ref_titles else 100
        
        # Calibrated: pass if coverage is at least 15%
        comparison_ok = coverage_pct >= 15.0
        
        return {
            "comparison_ok": comparison_ok,
            "coverage_pct": round(coverage_pct, 1),
            "matches_count": len(matches),
            "unmatched_ref_count": len(unmatched_ref_titles),
            "unmatched_ref_topics": unmatched_ref_titles[:5],
            "matches": matches[:5]
        }

    def _compare_jaccard(self, gen_texts, ref_texts, gen_topics, ref_topics, threshold, matches, unmatched_ref_titles):
        for i, gen_text in enumerate(gen_texts):
            best_sim = 0.0
            best_ref_idx = -1
            gen_tokens = set(re.findall(r"[a-z0-9]+", gen_text.lower()))
            
            for j, ref_text in enumerate(ref_texts):
                ref_tokens = set(re.findall(r"[a-z0-9]+", ref_text.lower()))
                sim = len(gen_tokens & ref_tokens) / len(gen_tokens | ref_tokens) if (gen_tokens or ref_tokens) else 0.0
                if sim > best_sim:
                    best_sim = sim
                    best_ref_idx = j
                    
            if best_sim >= threshold and best_ref_idx != -1:
                ref_title = ref_topics[best_ref_idx]["title"]
                matches.append({
                    "generated": gen_topics[i]["title"],
                    "reference": ref_title,
                    "similarity": round(best_sim, 3)
                })
                if ref_title in unmatched_ref_titles:
                    unmatched_ref_titles.remove(ref_title)

    # ========== INTEGRATION ==========

    def validate_all(self, topics: List[dict], case_info: dict) -> Dict[str, Any]:
        """Run all validation layers and compile the results."""
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
        results['validations']['relevance'] = self.check_relevance(topics, position, company, major_topic)
        
        # Layer 6: Golden Comparison (Similarity Search)
        results['validations']['golden_comparison'] = self.compare_with_golden(topics, position, company)
        
        # Overall content status check
        required_layers = ['rules', 'diversity', 'time_fit', 'consistency', 'relevance', 'golden_comparison']
        results['content_ok'] = all(
            results['validations'][layer].get(
                [k for k in results['validations'][layer].keys() if k.endswith('_ok')][0], 
                True
            )
            for layer in required_layers
            if layer in results['validations']
        )
        
        return results
