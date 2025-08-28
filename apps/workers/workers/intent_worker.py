import asyncio
import logging
from typing import Dict, Any, List
import re

logger = logging.getLogger(__name__)

class IntentWorker:
    def __init__(self):
        # Intent classification patterns
        self.intent_patterns = {
            'informational': [
                r'\b(what|how|why|when|where|who|which)\b',
                r'\b(guide|tutorial|learn|understand|explain|definition)\b',
                r'\b(tips|advice|help|information|facts)\b',
                r'\b(example|examples|case study|research)\b',
            ],
            'commercial': [
                r'\b(best|top|compare|comparison|vs|versus)\b',
                r'\b(review|reviews|rating|ratings|recommendation)\b',
                r'\b(software|tool|platform|service|solution)\b',
                r'\b(company|agency|provider|vendor)\b',
            ],
            'transactional': [
                r'\b(buy|purchase|order|shop|shopping)\b',
                r'\b(price|cost|pricing|quote|estimate)\b',
                r'\b(discount|deal|offer|sale|promotion)\b',
                r'\b(free trial|demo|sign up|register)\b',
            ],
            'navigational': [
                r'\b(login|sign in|account|dashboard)\b',
                r'\b(contact|support|help desk|customer service)\b',
                r'\b(about|team|careers|jobs)\b',
                r'\b(blog|news|press|media)\b',
            ],
            'local': [
                r'\b(near me|nearby|local|location)\b',
                r'\b(address|directions|map|find)\b',
                r'\b(restaurant|store|shop|business)\b',
                r'\b(city|town|area|region)\b',
            ]
        }
        
        # Intent modifiers
        self.modifiers = {
            'informational': ['learn', 'understand', 'guide', 'tutorial'],
            'commercial': ['best', 'top', 'compare', 'review'],
            'transactional': ['buy', 'price', 'cost', 'purchase'],
            'navigational': ['login', 'contact', 'about', 'support'],
            'local': ['near me', 'local', 'location', 'address']
        }
    
    async def classify_intent(self, keyword: str, serp_results: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Classify the intent of a keyword
        """
        logger.info(f"Classifying intent for: {keyword}")
        
        # Initialize scores
        intent_scores = {
            'informational': 0.0,
            'commercial': 0.0,
            'transactional': 0.0,
            'navigational': 0.0,
            'local': 0.0
        }
        
        # Analyze keyword patterns
        keyword_scores = self._analyze_keyword_patterns(keyword)
        
        # Analyze SERP results if available
        serp_scores = {}
        if serp_results:
            serp_scores = self._analyze_serp_results(serp_results)
        
        # Combine scores
        for intent in intent_scores:
            keyword_score = keyword_scores.get(intent, 0.0)
            serp_score = serp_scores.get(intent, 0.0)
            
            # Weight keyword analysis more heavily (70% keyword, 30% SERP)
            intent_scores[intent] = (keyword_score * 0.7) + (serp_score * 0.3)
        
        # Normalize scores
        total_score = sum(intent_scores.values())
        if total_score > 0:
            for intent in intent_scores:
                intent_scores[intent] = intent_scores[intent] / total_score
        
        # Determine primary intent
        primary_intent = max(intent_scores, key=intent_scores.get)
        confidence = intent_scores[primary_intent]
        
        # Calculate confidence based on score distribution
        sorted_scores = sorted(intent_scores.values(), reverse=True)
        if len(sorted_scores) > 1:
            confidence_gap = sorted_scores[0] - sorted_scores[1]
            confidence = min(confidence + confidence_gap, 1.0)
        
        result = {
            'intent_scores': intent_scores,
            'primary_intent': primary_intent,
            'confidence': confidence,
            'analysis': {
                'keyword_analysis': keyword_scores,
                'serp_analysis': serp_scores if serp_results else None
            }
        }
        
        logger.info(f"Intent classification: {primary_intent} (confidence: {confidence:.2f})")
        return result
    
    def _analyze_keyword_patterns(self, keyword: str) -> Dict[str, float]:
        """
        Analyze keyword patterns to determine intent
        """
        scores = {intent: 0.0 for intent in self.intent_patterns}
        keyword_lower = keyword.lower()
        
        # Check each intent pattern
        for intent, patterns in self.intent_patterns.items():
            score = 0.0
            matches = 0
            
            for pattern in patterns:
                if re.search(pattern, keyword_lower):
                    matches += 1
                    score += 0.3  # Base score for each match
            
            # Bonus for multiple matches
            if matches > 1:
                score += 0.2
            
            # Check for modifiers
            for modifier in self.modifiers[intent]:
                if modifier in keyword_lower:
                    score += 0.2
            
            scores[intent] = min(score, 1.0)
        
        return scores
    
    def _analyze_serp_results(self, serp_results: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Analyze SERP results to determine intent
        """
        scores = {intent: 0.0 for intent in self.intent_patterns}
        
        # Analyze titles and snippets
        for result in serp_results:
            text = f"{result.get('title', '')} {result.get('snippet', '')}".lower()
            
            # Check for intent indicators in SERP content
            for intent, patterns in self.intent_patterns.items():
                for pattern in patterns:
                    if re.search(pattern, text):
                        scores[intent] += 0.1
            
            # Analyze content type
            content_type = result.get('content_type', 'general')
            if content_type == 'how_to':
                scores['informational'] += 0.2
            elif content_type == 'review':
                scores['commercial'] += 0.2
            elif content_type == 'tools':
                scores['commercial'] += 0.15
        
        # Normalize scores
        total_score = sum(scores.values())
        if total_score > 0:
            for intent in scores:
                scores[intent] = min(scores[intent] / total_score, 1.0)
        
        return scores
    
    async def classify_batch(self, keywords: List[str]) -> List[Dict[str, Any]]:
        """
        Classify intent for multiple keywords
        """
        logger.info(f"Classifying intent for {len(keywords)} keywords")
        
        results = []
        for keyword in keywords:
            try:
                intent_result = await self.classify_intent(keyword)
                results.append({
                    'keyword': keyword,
                    'intent': intent_result
                })
            except Exception as e:
                logger.error(f"Failed to classify intent for {keyword}: {e}")
                results.append({
                    'keyword': keyword,
                    'intent': {
                        'primary_intent': 'informational',
                        'confidence': 0.0,
                        'intent_scores': {
                            'informational': 1.0,
                            'commercial': 0.0,
                            'transactional': 0.0,
                            'navigational': 0.0,
                            'local': 0.0
                        }
                    }
                })
        
        return results
    
    def get_intent_description(self, intent: str) -> str:
        """
        Get a description of the intent type
        """
        descriptions = {
            'informational': 'User wants to learn or understand something',
            'commercial': 'User wants to compare options or find the best solution',
            'transactional': 'User wants to buy or take action',
            'navigational': 'User wants to find a specific website or page',
            'local': 'User wants to find something nearby or location-specific'
        }
        
        return descriptions.get(intent, 'Unknown intent')

# Example usage
async def main():
    worker = IntentWorker()
    
    # Test keywords
    test_keywords = [
        "how to start digital marketing",
        "best digital marketing tools",
        "digital marketing agency pricing",
        "digital marketing login",
        "digital marketing services near me"
    ]
    
    for keyword in test_keywords:
        result = await worker.classify_intent(keyword)
        print(f"Keyword: {keyword}")
        print(f"Primary Intent: {result['primary_intent']}")
        print(f"Confidence: {result['confidence']:.2f}")
        print(f"Description: {worker.get_intent_description(result['primary_intent'])}")
        print()

if __name__ == "__main__":
    asyncio.run(main())
