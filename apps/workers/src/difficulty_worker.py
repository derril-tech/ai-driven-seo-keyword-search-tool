import asyncio
import logging
from typing import Dict, Any, List, Optional
import numpy as np

logger = logging.getLogger(__name__)

class DifficultyWorker:
    def __init__(self):
        self.logger = logger
        
    async def calculate_difficulty(self, keyword: str, serp_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate keyword difficulty based on SERP analysis"""
        try:
            # Calculate individual factors
            domain_authority_factor = self._calculate_domain_authority_factor(serp_results)
            serp_features_factor = self._calculate_serp_features_factor(serp_results)
            keyword_length_factor = self._calculate_keyword_length_factor(keyword)
            search_volume_factor = self._calculate_search_volume_factor(1000)  # Mock volume
            
            # Combine factors with weights
            factors = {
                'domain_authority': domain_authority_factor,
                'serp_features': serp_features_factor,
                'keyword_length': keyword_length_factor,
                'search_volume': search_volume_factor
            }
            
            # Calculate weighted difficulty score
            weights = {
                'domain_authority': 0.4,
                'serp_features': 0.3,
                'keyword_length': 0.2,
                'search_volume': 0.1
            }
            
            difficulty_score = sum(factors[key] * weights[key] for key in factors) * 100
            
            # Determine competition level
            competition_level = self._calculate_competition_level(difficulty_score)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(difficulty_score, factors)
            
            return {
                'difficulty_score': round(difficulty_score, 2),
                'factors': factors,
                'competition_level': competition_level,
                'recommendations': recommendations
            }
            
        except Exception as e:
            self.logger.error(f"Error calculating difficulty for {keyword}: {e}")
            return {
                'difficulty_score': 50,
                'factors': {},
                'competition_level': 'medium',
                'recommendations': ['Unable to calculate difficulty']
            }
    
    def _calculate_domain_authority_factor(self, serp_results: List[Dict[str, Any]]) -> float:
        """Calculate domain authority factor"""
        if not serp_results:
            return 0.0
        
        authorities = [result.get('domain_authority', 50) for result in serp_results]
        avg_authority = np.mean(authorities)
        
        # Normalize to 0-1 scale
        return min(avg_authority / 100, 1.0)
    
    def _calculate_serp_features_factor(self, serp_results: List[Dict[str, Any]]) -> float:
        """Calculate SERP features factor"""
        if not serp_results:
            return 0.0
        
        feature_counts = []
        for result in serp_results:
            features = result.get('features', [])
            feature_counts.append(len(features))
        
        avg_features = np.mean(feature_counts)
        
        # Normalize to 0-1 scale (max 5 features)
        return min(avg_features / 5, 1.0)
    
    def _calculate_keyword_length_factor(self, keyword: str) -> float:
        """Calculate keyword length factor (longer = easier)"""
        word_count = len(keyword.split())
        
        # Shorter keywords are harder (higher factor)
        if word_count <= 2:
            return 0.9
        elif word_count <= 4:
            return 0.7
        elif word_count <= 6:
            return 0.5
        else:
            return 0.3
    
    def _calculate_search_volume_factor(self, search_volume: int) -> float:
        """Calculate search volume factor"""
        # Higher volume = harder (higher factor)
        if search_volume <= 100:
            return 0.1
        elif search_volume <= 1000:
            return 0.3
        elif search_volume <= 10000:
            return 0.6
        elif search_volume <= 100000:
            return 0.8
        else:
            return 1.0
    
    def _calculate_competition_level(self, difficulty_score: float) -> str:
        """Determine competition level based on difficulty score"""
        if difficulty_score < 30:
            return "low"
        elif difficulty_score < 50:
            return "medium"
        elif difficulty_score < 70:
            return "high"
        else:
            return "very_high"
    
    def _generate_recommendations(self, difficulty_score: float, factors: Dict[str, float]) -> List[str]:
        """Generate recommendations based on difficulty and factors"""
        recommendations = []
        
        if difficulty_score > 70:
            recommendations.extend([
                "Consider long-tail keyword variations",
                "Focus on niche topics within this keyword",
                "Build comprehensive, high-quality content",
                "Target related keywords with lower competition"
            ])
        elif difficulty_score > 50:
            recommendations.extend([
                "Optimize content for featured snippets",
                "Improve on-page SEO elements",
                "Build quality backlinks",
                "Create comprehensive content clusters"
            ])
        else:
            recommendations.extend([
                "Optimize content for this keyword",
                "Build internal linking structure",
                "Create supporting content",
                "Monitor rankings and adjust strategy"
            ])
        
        # Add specific recommendations based on factors
        if factors.get('domain_authority', 0) > 0.7:
            recommendations.append("Focus on building domain authority")
        
        if factors.get('serp_features', 0) > 0.6:
            recommendations.append("Optimize for SERP features like featured snippets")
        
        return recommendations
    
    async def calculate_difficulty_batch(self, keywords_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Calculate difficulty for multiple keywords"""
        results = []
        
        for keyword_data in keywords_data:
            keyword = keyword_data['keyword']
            serp_results = keyword_data.get('serp_results', [])
            
            difficulty = await self.calculate_difficulty(keyword, serp_results)
            difficulty['keyword'] = keyword
            
            results.append(difficulty)
        
        return results
