import asyncio
import logging
from typing import Dict, Any, List, Optional
import re

logger = logging.getLogger(__name__)

class SerpFeatureParser:
    def __init__(self):
        self.logger = logger
        
    async def parse_serp_features(self, serp_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Parse SERP features and extract insights"""
        try:
            # Extract various SERP features
            featured_snippets = self._extract_featured_snippets(serp_results)
            people_also_ask = self._extract_people_also_ask(serp_results)
            local_packs = self._extract_local_packs(serp_results)
            video_results = self._extract_video_results(serp_results)
            shopping_results = self._extract_shopping_results(serp_results)
            related_searches = self._extract_related_searches(serp_results)
            knowledge_graph = self._extract_knowledge_graph(serp_results)
            schema_markup = self._extract_schema_markup(serp_results)
            
            # Analyze content types and intent
            content_types = self._analyze_content_types(serp_results)
            intent_signals = self._analyze_intent_signals(serp_results)
            competition = self._analyze_competition(serp_results)
            
            # Combine all features
            features = []
            features.extend(featured_snippets)
            features.extend(people_also_ask)
            features.extend(local_packs)
            features.extend(video_results)
            features.extend(shopping_results)
            features.extend(related_searches)
            features.extend(knowledge_graph)
            features.extend(schema_markup)
            
            return {
                'features': features,
                'content_types': content_types,
                'intent_signals': intent_signals,
                'competition_analysis': competition
            }
            
        except Exception as e:
            self.logger.error(f"Error parsing SERP features: {e}")
            return {
                'features': [],
                'content_types': {},
                'intent_signals': {},
                'competition_analysis': {}
            }
    
    def _extract_featured_snippets(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract featured snippets from SERP results"""
        featured_snippets = []
        
        for result in serp_results:
            if 'featured_snippet' in result.get('features', []):
                featured_snippets.append({
                    'type': 'featured_snippet',
                    'title': result.get('title', ''),
                    'snippet': result.get('snippet', ''),
                    'position': result.get('position', 0),
                    'url': result.get('url', '')
                })
        
        return featured_snippets
    
    def _extract_people_also_ask(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract People Also Ask questions"""
        questions = []
        
        # Mock PAA questions based on content
        for result in serp_results:
            if 'how_to' in result.get('features', []):
                questions.append({
                    'type': 'people_also_ask',
                    'question': f"How to {result.get('title', '').lower()}",
                    'answer': result.get('snippet', '')[:200] + '...'
                })
        
        return questions
    
    def _extract_local_packs(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract local pack results"""
        local_packs = []
        
        # Check for local intent in titles
        for result in serp_results:
            title = result.get('title', '').lower()
            if any(word in title for word in ['near me', 'local', 'nearby']):
                local_packs.append({
                    'type': 'local_pack',
                    'business_name': result.get('title', ''),
                    'address': 'Mock Address',
                    'rating': 4.5,
                    'reviews': 100
                })
        
        return local_packs
    
    def _extract_video_results(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract video results"""
        videos = []
        
        for result in serp_results:
            if 'video' in result.get('features', []):
                videos.append({
                    'type': 'video',
                    'title': result.get('title', ''),
                    'url': result.get('url', ''),
                    'duration': '5:30',
                    'thumbnail': 'mock_thumbnail.jpg'
                })
        
        return videos
    
    def _extract_shopping_results(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract shopping results"""
        shopping = []
        
        for result in serp_results:
            title = result.get('title', '').lower()
            if any(word in title for word in ['buy', 'price', 'shop', 'store']):
                shopping.append({
                    'type': 'shopping',
                    'title': result.get('title', ''),
                    'price': '$99.99',
                    'store': 'Mock Store',
                    'rating': 4.2
                })
        
        return shopping
    
    def _extract_related_searches(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract related searches"""
        related = []
        
        # Generate related searches based on content
        keywords = ['best', 'top', 'how to', 'guide', 'tutorial', 'review']
        for result in serp_results:
            title = result.get('title', '')
            for keyword in keywords:
                related.append({
                    'type': 'related_search',
                    'query': f"{keyword} {title.lower()}"
                })
        
        return related[:5]  # Limit to 5 related searches
    
    def _extract_knowledge_graph(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract knowledge graph data"""
        knowledge = []
        
        # Check for knowledge graph indicators
        for result in serp_results:
            if result.get('position', 0) == 1 and 'featured_snippet' in result.get('features', []):
                knowledge.append({
                    'type': 'knowledge_graph',
                    'title': result.get('title', ''),
                    'description': result.get('snippet', ''),
                    'facts': ['Mock fact 1', 'Mock fact 2']
                })
                break
        
        return knowledge
    
    def _extract_schema_markup(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract schema markup information"""
        schema = []
        
        for result in serp_results:
            content_type = self._detect_content_type_from_title(result.get('title', ''))
            if content_type:
                schema.append({
                    'type': 'schema_markup',
                    'schema_type': content_type,
                    'data': {
                        'title': result.get('title', ''),
                        'description': result.get('snippet', '')
                    }
                })
        
        return schema
    
    def _analyze_content_types(self, serp_results: List[Dict[str, Any]]) -> Dict[str, int]:
        """Analyze content types in SERP results"""
        content_types = {
            'how_to': 0,
            'review': 0,
            'service': 0,
            'course': 0,
            'blog': 0,
            'article': 0
        }
        
        for result in serp_results:
            content_type = self._detect_content_type_from_title(result.get('title', ''))
            if content_type in content_types:
                content_types[content_type] += 1
        
        return content_types
    
    def _analyze_intent_signals(self, serp_results: List[Dict[str, Any]]) -> Dict[str, float]:
        """Analyze intent signals from SERP results"""
        intent_signals = {
            'informational': 0.0,
            'commercial': 0.0,
            'transactional': 0.0,
            'navigational': 0.0,
            'local': 0.0
        }
        
        for result in serp_results:
            intent = self._detect_intent_from_title(result.get('title', ''))
            if intent in intent_signals:
                intent_signals[intent] += 1
        
        # Normalize to 0-1 scale
        total = sum(intent_signals.values())
        if total > 0:
            for intent in intent_signals:
                intent_signals[intent] = intent_signals[intent] / total
        
        return intent_signals
    
    def _analyze_competition(self, serp_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze competition level"""
        if not serp_results:
            return {
                'domain_authority_avg': 0,
                'feature_richness': 0,
                'content_quality': 0,
                'competition_level': 'low'
            }
        
        # Calculate average domain authority
        authorities = [self._calculate_domain_authority(result.get('domain', 'example.com')) 
                      for result in serp_results]
        avg_authority = sum(authorities) / len(authorities)
        
        # Calculate feature richness
        feature_richness = self._calculate_feature_richness(serp_results)
        
        # Calculate content quality
        content_quality = self._calculate_content_quality(serp_results)
        
        # Determine competition level
        competition_score = (avg_authority + feature_richness * 100 + content_quality * 100) / 3
        competition_level = self._get_competition_level(competition_score)
        
        return {
            'domain_authority_avg': round(avg_authority, 2),
            'feature_richness': round(feature_richness, 3),
            'content_quality': round(content_quality, 3),
            'competition_level': competition_level
        }
    
    def _detect_content_type_from_title(self, title: str) -> str:
        """Detect content type from title"""
        title_lower = title.lower()
        
        if any(word in title_lower for word in ['how to', 'guide', 'tutorial', 'learn']):
            return 'how_to'
        elif any(word in title_lower for word in ['best', 'top', 'review', 'comparison']):
            return 'review'
        elif any(word in title_lower for word in ['service', 'agency', 'company']):
            return 'service'
        elif any(word in title_lower for word in ['course', 'training', 'class']):
            return 'course'
        elif any(word in title_lower for word in ['blog', 'post', 'article']):
            return 'blog'
        else:
            return 'article'
    
    def _detect_intent_from_title(self, title: str) -> str:
        """Detect intent from title"""
        title_lower = title.lower()
        
        if any(word in title_lower for word in ['how to', 'what is', 'guide', 'learn']):
            return 'informational'
        elif any(word in title_lower for word in ['best', 'top', 'compare', 'review']):
            return 'commercial'
        elif any(word in title_lower for word in ['buy', 'purchase', 'download', 'order']):
            return 'transactional'
        elif any(word in title_lower for word in ['login', 'dashboard', 'admin']):
            return 'navigational'
        elif any(word in title_lower for word in ['near me', 'local', 'nearby']):
            return 'local'
        else:
            return 'informational'
    
    def _calculate_domain_authority(self, domain: str) -> int:
        """Calculate mock domain authority"""
        # Mock domain authority calculation
        if 'google' in domain:
            return 95
        elif 'facebook' in domain or 'amazon' in domain:
            return 90
        elif 'example' in domain:
            return 50
        else:
            return 30
    
    def _calculate_feature_richness(self, serp_results: List[Dict[str, Any]]) -> float:
        """Calculate feature richness"""
        if not serp_results:
            return 0.0
        
        total_features = sum(len(result.get('features', [])) for result in serp_results)
        return total_features / len(serp_results) / 5  # Normalize to 0-1
    
    def _calculate_content_quality(self, serp_results: List[Dict[str, Any]]) -> float:
        """Calculate content quality score"""
        if not serp_results:
            return 0.0
        
        quality_scores = []
        for result in serp_results:
            title = result.get('title', '')
            snippet = result.get('snippet', '')
            
            # Simple quality heuristics
            title_length = len(title)
            snippet_length = len(snippet)
            
            score = 0.5  # Base score
            if 20 <= title_length <= 60:
                score += 0.2
            if snippet_length > 100:
                score += 0.3
            
            quality_scores.append(score)
        
        return sum(quality_scores) / len(quality_scores)
    
    def _get_competition_level(self, score: float) -> str:
        """Get competition level from score"""
        if score < 30:
            return 'low'
        elif score < 50:
            return 'medium'
        elif score < 70:
            return 'high'
        else:
            return 'very_high'
