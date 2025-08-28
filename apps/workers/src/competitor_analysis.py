import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from dataclasses import dataclass
from datetime import datetime
import json
from urllib.parse import urlparse
from collections import defaultdict
import re

logger = logging.getLogger(__name__)

@dataclass
class CompetitorData:
    domain: str
    keyword_coverage: Dict[str, int]
    serp_positions: Dict[str, int]
    content_gaps: List[str]
    strengths: List[str]
    weaknesses: List[str]
    market_share: float
    threat_level: str  # 'low', 'medium', 'high', 'critical'
    created_at: datetime

@dataclass
class ContentGap:
    keyword: str
    search_volume: int
    difficulty: float
    current_competitors: List[str]
    opportunity_score: float
    content_type: str
    estimated_traffic_potential: int
    created_at: datetime

@dataclass
class CompetitiveLandscape:
    competitors: List[CompetitorData]
    content_gaps: List[ContentGap]
    market_analysis: Dict[str, Any]
    recommendations: List[str]
    created_at: datetime

class CompetitorAnalysisWorker:
    def __init__(self):
        self.logger = logger
        self.min_search_volume = 100  # Minimum search volume for gap analysis
        self.max_difficulty = 70  # Maximum difficulty for opportunity keywords
    
    async def analyze_competitors(self, target_domain: str, 
                                keywords: List[Dict[str, Any]], 
                                serp_results: List[Dict[str, Any]]) -> CompetitiveLandscape:
        """Analyze competitors and identify content gaps"""
        try:
            self.logger.info(f"Starting competitor analysis for {target_domain}")
            
            # Extract competitor domains from SERP results
            competitor_domains = await self._extract_competitor_domains(serp_results, target_domain)
            
            # Analyze each competitor
            competitors = []
            for domain in competitor_domains:
                competitor_data = await self._analyze_competitor(domain, keywords, serp_results)
                competitors.append(competitor_data)
            
            # Identify content gaps
            content_gaps = await self._identify_content_gaps(keywords, serp_results, target_domain)
            
            # Analyze market landscape
            market_analysis = await self._analyze_market_landscape(competitors, keywords)
            
            # Generate recommendations
            recommendations = await self._generate_recommendations(competitors, content_gaps, target_domain)
            
            landscape = CompetitiveLandscape(
                competitors=competitors,
                content_gaps=content_gaps,
                market_analysis=market_analysis,
                recommendations=recommendations,
                created_at=datetime.utcnow()
            )
            
            self.logger.info(f"Competitor analysis completed: {len(competitors)} competitors, {len(content_gaps)} gaps")
            return landscape
            
        except Exception as e:
            self.logger.error(f"Error in competitor analysis: {e}")
            raise
    
    async def _extract_competitor_domains(self, serp_results: List[Dict[str, Any]], 
                                        target_domain: str) -> List[str]:
        """Extract competitor domains from SERP results"""
        try:
            domains = set()
            
            for result in serp_results:
                if 'url' in result:
                    domain = urlparse(result['url']).netloc
                    if domain and domain != target_domain:
                        # Remove www. prefix
                        domain = domain.replace('www.', '')
                        domains.add(domain)
            
            # Count domain frequency
            domain_counts = defaultdict(int)
            for result in serp_results:
                if 'url' in result:
                    domain = urlparse(result['url']).netloc.replace('www.', '')
                    if domain != target_domain:
                        domain_counts[domain] += 1
            
            # Return top competitors (domains appearing most frequently)
            sorted_domains = sorted(domain_counts.items(), key=lambda x: x[1], reverse=True)
            top_competitors = [domain for domain, count in sorted_domains[:10]]
            
            return top_competitors
            
        except Exception as e:
            self.logger.error(f"Error extracting competitor domains: {e}")
            return []
    
    async def _analyze_competitor(self, domain: str, 
                                keywords: List[Dict[str, Any]], 
                                serp_results: List[Dict[str, Any]]) -> CompetitorData:
        """Analyze a single competitor"""
        try:
            # Analyze keyword coverage
            keyword_coverage = await self._analyze_keyword_coverage(domain, keywords, serp_results)
            
            # Analyze SERP positions
            serp_positions = await self._analyze_serp_positions(domain, serp_results)
            
            # Identify content gaps
            content_gaps = await self._identify_competitor_gaps(domain, keywords, serp_results)
            
            # Analyze strengths and weaknesses
            strengths, weaknesses = await self._analyze_competitor_profile(domain, serp_results)
            
            # Calculate market share
            market_share = await self._calculate_market_share(domain, serp_results)
            
            # Determine threat level
            threat_level = await self._determine_threat_level(domain, keyword_coverage, market_share)
            
            competitor_data = CompetitorData(
                domain=domain,
                keyword_coverage=keyword_coverage,
                serp_positions=serp_positions,
                content_gaps=content_gaps,
                strengths=strengths,
                weaknesses=weaknesses,
                market_share=market_share,
                threat_level=threat_level,
                created_at=datetime.utcnow()
            )
            
            return competitor_data
            
        except Exception as e:
            self.logger.error(f"Error analyzing competitor {domain}: {e}")
            raise
    
    async def _analyze_keyword_coverage(self, domain: str, 
                                      keywords: List[Dict[str, Any]], 
                                      serp_results: List[Dict[str, Any]]) -> Dict[str, int]:
        """Analyze keyword coverage for a competitor"""
        try:
            coverage = {
                'total_keywords': len(keywords),
                'ranked_keywords': 0,
                'top_3_positions': 0,
                'top_10_positions': 0,
                'average_position': 0
            }
            
            positions = []
            
            for keyword_data in keywords:
                keyword = keyword_data.get('keyword', '')
                
                # Find SERP results for this keyword
                keyword_results = [r for r in serp_results if r.get('keyword') == keyword]
                
                for result in keyword_results:
                    result_domain = urlparse(result.get('url', '')).netloc.replace('www.', '')
                    if result_domain == domain:
                        position = result.get('position', 0)
                        positions.append(position)
                        
                        if position <= 10:
                            coverage['ranked_keywords'] += 1
                        if position <= 3:
                            coverage['top_3_positions'] += 1
                        if position <= 10:
                            coverage['top_10_positions'] += 1
            
            if positions:
                coverage['average_position'] = np.mean(positions)
            
            return coverage
            
        except Exception as e:
            self.logger.error(f"Error analyzing keyword coverage: {e}")
            return {'total_keywords': 0, 'ranked_keywords': 0, 'top_3_positions': 0, 'top_10_positions': 0, 'average_position': 0}
    
    async def _analyze_serp_positions(self, domain: str, 
                                    serp_results: List[Dict[str, Any]]) -> Dict[str, int]:
        """Analyze SERP positions for a competitor"""
        try:
            positions = {
                'total_appearances': 0,
                'position_1': 0,
                'position_2_3': 0,
                'position_4_10': 0,
                'position_11_20': 0,
                'average_position': 0
            }
            
            domain_positions = []
            
            for result in serp_results:
                result_domain = urlparse(result.get('url', '')).netloc.replace('www.', '')
                if result_domain == domain:
                    position = result.get('position', 0)
                    domain_positions.append(position)
                    positions['total_appearances'] += 1
                    
                    if position == 1:
                        positions['position_1'] += 1
                    elif 2 <= position <= 3:
                        positions['position_2_3'] += 1
                    elif 4 <= position <= 10:
                        positions['position_4_10'] += 1
                    elif 11 <= position <= 20:
                        positions['position_11_20'] += 1
            
            if domain_positions:
                positions['average_position'] = np.mean(domain_positions)
            
            return positions
            
        except Exception as e:
            self.logger.error(f"Error analyzing SERP positions: {e}")
            return {'total_appearances': 0, 'position_1': 0, 'position_2_3': 0, 'position_4_10': 0, 'position_11_20': 0, 'average_position': 0}
    
    async def _identify_competitor_gaps(self, domain: str, 
                                      keywords: List[Dict[str, Any]], 
                                      serp_results: List[Dict[str, Any]]) -> List[str]:
        """Identify content gaps for a competitor"""
        try:
            gaps = []
            
            # Find keywords where competitor doesn't rank
            for keyword_data in keywords:
                keyword = keyword_data.get('keyword', '')
                search_volume = keyword_data.get('search_volume', 0)
                
                # Check if competitor ranks for this keyword
                competitor_ranks = False
                for result in serp_results:
                    if result.get('keyword') == keyword:
                        result_domain = urlparse(result.get('url', '')).netloc.replace('www.', '')
                        if result_domain == domain:
                            competitor_ranks = True
                            break
                
                if not competitor_ranks and search_volume >= self.min_search_volume:
                    gaps.append(keyword)
            
            return gaps[:20]  # Limit to top 20 gaps
            
        except Exception as e:
            self.logger.error(f"Error identifying competitor gaps: {e}")
            return []
    
    async def _analyze_competitor_profile(self, domain: str, 
                                        serp_results: List[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
        """Analyze competitor strengths and weaknesses"""
        try:
            strengths = []
            weaknesses = []
            
            # Analyze SERP features
            feature_counts = defaultdict(int)
            total_appearances = 0
            
            for result in serp_results:
                result_domain = urlparse(result.get('url', '')).netloc.replace('www.', '')
                if result_domain == domain:
                    total_appearances += 1
                    features = result.get('features', [])
                    for feature in features:
                        feature_counts[feature] += 1
            
            # Determine strengths
            if feature_counts.get('featured_snippet', 0) > 0:
                strengths.append("Strong featured snippet presence")
            
            if feature_counts.get('people_also_ask', 0) > 0:
                strengths.append("Good PAA coverage")
            
            if feature_counts.get('local_pack', 0) > 0:
                strengths.append("Local search dominance")
            
            # Determine weaknesses
            if total_appearances > 0:
                avg_position = sum(r.get('position', 0) for r in serp_results 
                                 if urlparse(r.get('url', '')).netloc.replace('www.', '') == domain) / total_appearances
                
                if avg_position > 10:
                    weaknesses.append("Poor average SERP position")
                
                if feature_counts.get('featured_snippet', 0) == 0:
                    weaknesses.append("No featured snippets")
                
                if feature_counts.get('video', 0) == 0:
                    weaknesses.append("No video content")
            
            return strengths, weaknesses
            
        except Exception as e:
            self.logger.error(f"Error analyzing competitor profile: {e}")
            return [], []
    
    async def _calculate_market_share(self, domain: str, 
                                    serp_results: List[Dict[str, Any]]) -> float:
        """Calculate market share for a competitor"""
        try:
            total_results = len(serp_results)
            if total_results == 0:
                return 0.0
            
            domain_results = sum(1 for result in serp_results 
                               if urlparse(result.get('url', '')).netloc.replace('www.', '') == domain)
            
            market_share = (domain_results / total_results) * 100
            return round(market_share, 2)
            
        except Exception as e:
            self.logger.error(f"Error calculating market share: {e}")
            return 0.0
    
    async def _determine_threat_level(self, domain: str, 
                                    keyword_coverage: Dict[str, int], 
                                    market_share: float) -> str:
        """Determine threat level for a competitor"""
        try:
            # Calculate threat score based on multiple factors
            threat_score = 0
            
            # Market share factor (0-40 points)
            threat_score += min(market_share * 0.4, 40)
            
            # Keyword coverage factor (0-30 points)
            coverage_ratio = keyword_coverage.get('ranked_keywords', 0) / max(keyword_coverage.get('total_keywords', 1), 1)
            threat_score += coverage_ratio * 30
            
            # Position factor (0-30 points)
            avg_position = keyword_coverage.get('average_position', 0)
            if avg_position > 0:
                position_score = max(0, 30 - (avg_position - 1) * 2)
                threat_score += position_score
            
            # Determine threat level
            if threat_score >= 80:
                return 'critical'
            elif threat_score >= 60:
                return 'high'
            elif threat_score >= 40:
                return 'medium'
            else:
                return 'low'
                
        except Exception as e:
            self.logger.error(f"Error determining threat level: {e}")
            return 'low'
    
    async def _identify_content_gaps(self, keywords: List[Dict[str, Any]], 
                                   serp_results: List[Dict[str, Any]], 
                                   target_domain: str) -> List[ContentGap]:
        """Identify content gaps for the target domain"""
        try:
            content_gaps = []
            
            for keyword_data in keywords:
                keyword = keyword_data.get('keyword', '')
                search_volume = keyword_data.get('search_volume', 0)
                difficulty = keyword_data.get('difficulty', 0)
                
                # Check if target domain ranks for this keyword
                target_ranks = False
                target_position = 0
                current_competitors = []
                
                for result in serp_results:
                    if result.get('keyword') == keyword:
                        result_domain = urlparse(result.get('url', '')).netloc.replace('www.', '')
                        if result_domain == target_domain:
                            target_ranks = True
                            target_position = result.get('position', 0)
                        elif result.get('position', 0) <= 10:
                            current_competitors.append(result_domain)
                
                # Identify gaps and opportunities
                if not target_ranks and search_volume >= self.min_search_volume and difficulty <= self.max_difficulty:
                    # Calculate opportunity score
                    opportunity_score = await self._calculate_opportunity_score(
                        search_volume, difficulty, len(current_competitors)
                    )
                    
                    # Determine content type
                    content_type = await self._determine_content_type(keyword)
                    
                    # Estimate traffic potential
                    traffic_potential = await self._estimate_traffic_potential(
                        search_volume, difficulty, opportunity_score
                    )
                    
                    content_gap = ContentGap(
                        keyword=keyword,
                        search_volume=search_volume,
                        difficulty=difficulty,
                        current_competitors=current_competitors,
                        opportunity_score=opportunity_score,
                        content_type=content_type,
                        estimated_traffic_potential=traffic_potential,
                        created_at=datetime.utcnow()
                    )
                    
                    content_gaps.append(content_gap)
                
                elif target_ranks and target_position > 10:
                    # Opportunity to improve existing content
                    opportunity_score = await self._calculate_improvement_opportunity(
                        search_volume, difficulty, target_position
                    )
                    
                    if opportunity_score > 0.5:  # High improvement opportunity
                        content_type = await self._determine_content_type(keyword)
                        traffic_potential = await self._estimate_traffic_potential(
                            search_volume, difficulty, opportunity_score
                        )
                        
                        content_gap = ContentGap(
                            keyword=keyword,
                            search_volume=search_volume,
                            difficulty=difficulty,
                            current_competitors=current_competitors,
                            opportunity_score=opportunity_score,
                            content_type=f"Improve {content_type}",
                            estimated_traffic_potential=traffic_potential,
                            created_at=datetime.utcnow()
                        )
                        
                        content_gaps.append(content_gap)
            
            # Sort by opportunity score
            content_gaps.sort(key=lambda x: x.opportunity_score, reverse=True)
            
            return content_gaps[:50]  # Return top 50 opportunities
            
        except Exception as e:
            self.logger.error(f"Error identifying content gaps: {e}")
            return []
    
    async def _calculate_opportunity_score(self, search_volume: int, 
                                         difficulty: float, 
                                         competitor_count: int) -> float:
        """Calculate opportunity score for a keyword"""
        try:
            # Normalize factors (0-1 scale)
            volume_score = min(search_volume / 10000, 1.0)  # Cap at 10k searches
            difficulty_score = 1 - (difficulty / 100)  # Lower difficulty = higher score
            competition_score = max(0, 1 - (competitor_count / 10))  # Fewer competitors = higher score
            
            # Weighted combination
            opportunity_score = (volume_score * 0.4 + difficulty_score * 0.4 + competition_score * 0.2)
            
            return round(opportunity_score, 3)
            
        except Exception as e:
            self.logger.error(f"Error calculating opportunity score: {e}")
            return 0.0
    
    async def _calculate_improvement_opportunity(self, search_volume: int, 
                                              difficulty: float, 
                                              current_position: int) -> float:
        """Calculate improvement opportunity for existing content"""
        try:
            # Base opportunity on current position
            position_score = max(0, (20 - current_position) / 20)  # Better position = lower opportunity
            
            # Consider search volume and difficulty
            volume_score = min(search_volume / 10000, 1.0)
            difficulty_score = 1 - (difficulty / 100)
            
            improvement_score = (position_score * 0.5 + volume_score * 0.3 + difficulty_score * 0.2)
            
            return round(improvement_score, 3)
            
        except Exception as e:
            self.logger.error(f"Error calculating improvement opportunity: {e}")
            return 0.0
    
    async def _determine_content_type(self, keyword: str) -> str:
        """Determine optimal content type for a keyword"""
        try:
            keyword_lower = keyword.lower()
            
            if any(word in keyword_lower for word in ['how to', 'how-to', 'guide', 'tutorial']):
                return 'how-to-guide'
            elif any(word in keyword_lower for word in ['what is', 'definition', 'meaning']):
                return 'definition-article'
            elif any(word in keyword_lower for word in ['best', 'top', 'review', 'vs']):
                return 'comparison-article'
            elif any(word in keyword_lower for word in ['buy', 'purchase', 'price', 'cost']):
                return 'buying-guide'
            elif any(word in keyword_lower for word in ['near me', 'local', 'location']):
                return 'local-content'
            else:
                return 'informational-article'
                
        except Exception as e:
            self.logger.error(f"Error determining content type: {e}")
            return 'informational-article'
    
    async def _estimate_traffic_potential(self, search_volume: int, 
                                        difficulty: float, 
                                        opportunity_score: float) -> int:
        """Estimate traffic potential for a keyword"""
        try:
            # Base traffic on search volume
            base_traffic = search_volume * 0.1  # Assume 10% CTR for top position
            
            # Adjust for difficulty
            difficulty_factor = 1 - (difficulty / 100)
            
            # Adjust for opportunity score
            opportunity_factor = opportunity_score
            
            estimated_traffic = int(base_traffic * difficulty_factor * opportunity_factor)
            
            return max(0, estimated_traffic)
            
        except Exception as e:
            self.logger.error(f"Error estimating traffic potential: {e}")
            return 0
    
    async def _analyze_market_landscape(self, competitors: List[CompetitorData], 
                                      keywords: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze overall market landscape"""
        try:
            market_analysis = {
                'total_competitors': len(competitors),
                'market_concentration': 0.0,
                'average_market_share': 0.0,
                'threat_distribution': {
                    'critical': 0,
                    'high': 0,
                    'medium': 0,
                    'low': 0
                },
                'top_competitors': [],
                'market_gaps': []
            }
            
            if not competitors:
                return market_analysis
            
            # Calculate market concentration (Herfindahl-Hirschman Index)
            market_shares = [c.market_share for c in competitors]
            hhi = sum(share ** 2 for share in market_shares)
            market_analysis['market_concentration'] = round(hhi, 2)
            
            # Calculate average market share
            market_analysis['average_market_share'] = round(np.mean(market_shares), 2)
            
            # Count threat levels
            for competitor in competitors:
                market_analysis['threat_distribution'][competitor.threat_level] += 1
            
            # Identify top competitors
            top_competitors = sorted(competitors, key=lambda x: x.market_share, reverse=True)[:5]
            market_analysis['top_competitors'] = [
                {
                    'domain': c.domain,
                    'market_share': c.market_share,
                    'threat_level': c.threat_level,
                    'keyword_coverage': c.keyword_coverage['ranked_keywords']
                }
                for c in top_competitors
            ]
            
            # Identify market gaps
            market_analysis['market_gaps'] = await self._identify_market_gaps(competitors, keywords)
            
            return market_analysis
            
        except Exception as e:
            self.logger.error(f"Error analyzing market landscape: {e}")
            return {}
    
    async def _identify_market_gaps(self, competitors: List[CompetitorData], 
                                  keywords: List[Dict[str, Any]]) -> List[str]:
        """Identify gaps in the overall market"""
        try:
            gaps = []
            
            # Find keywords with low competition
            for keyword_data in keywords:
                keyword = keyword_data.get('keyword', '')
                search_volume = keyword_data.get('search_volume', 0)
                
                # Count how many competitors rank for this keyword
                competitor_count = 0
                for competitor in competitors:
                    if keyword in competitor.content_gaps:
                        competitor_count += 1
                
                # If few competitors rank, it's a market gap
                if competitor_count <= 2 and search_volume >= self.min_search_volume:
                    gaps.append(keyword)
            
            return gaps[:20]  # Return top 20 market gaps
            
        except Exception as e:
            self.logger.error(f"Error identifying market gaps: {e}")
            return []
    
    async def _generate_recommendations(self, competitors: List[CompetitorData], 
                                      content_gaps: List[ContentGap], 
                                      target_domain: str) -> List[str]:
        """Generate strategic recommendations"""
        try:
            recommendations = []
            
            # Analyze top competitors
            top_competitors = [c for c in competitors if c.threat_level in ['high', 'critical']]
            
            if top_competitors:
                recommendations.append(f"Focus on competing with {len(top_competitors)} high-threat competitors")
                
                for competitor in top_competitors[:3]:
                    if competitor.strengths:
                        recommendations.append(f"Learn from {competitor.domain}'s strengths: {', '.join(competitor.strengths[:2])}")
            
            # Content gap recommendations
            high_opportunity_gaps = [gap for gap in content_gaps if gap.opportunity_score > 0.7]
            if high_opportunity_gaps:
                recommendations.append(f"Prioritize {len(high_opportunity_gaps)} high-opportunity content gaps")
                
                # Group by content type
                content_types = defaultdict(int)
                for gap in high_opportunity_gaps:
                    content_types[gap.content_type] += 1
                
                top_content_type = max(content_types.items(), key=lambda x: x[1])
                recommendations.append(f"Focus on creating {top_content_type[0]} content ({top_content_type[1]} opportunities)")
            
            # Market positioning recommendations
            if len(competitors) > 5:
                recommendations.append("Consider niche positioning to differentiate from crowded market")
            
            # Traffic potential recommendations
            total_traffic_potential = sum(gap.estimated_traffic_potential for gap in content_gaps[:20])
            if total_traffic_potential > 10000:
                recommendations.append(f"Content gap opportunities could generate ~{total_traffic_potential:,} additional monthly visitors")
            
            return recommendations
            
        except Exception as e:
            self.logger.error(f"Error generating recommendations: {e}")
            return ["Focus on high-opportunity content gaps", "Monitor competitor strategies"]
