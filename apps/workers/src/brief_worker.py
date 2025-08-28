import asyncio
import logging
from typing import Dict, Any, List, Optional
import json
from dataclasses import dataclass
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

@dataclass
class ContentBrief:
    id: str
    keyword: str
    title: str
    meta_description: str
    outline: List[Dict[str, Any]]
    faqs: List[Dict[str, Any]]
    entities: List[str]
    internal_links: List[Dict[str, Any]]
    external_links: List[Dict[str, Any]]
    content_type: str
    target_audience: str
    content_goals: List[str]
    seo_notes: List[str]
    created_at: datetime
    updated_at: datetime

class BriefWorker:
    def __init__(self):
        self.logger = logger
        self.content_types = {
            'informational': {
                'template': 'how-to-guide',
                'structure': ['introduction', 'what-is', 'how-to', 'tips', 'conclusion'],
                'tone': 'educational'
            },
            'commercial': {
                'template': 'product-comparison',
                'structure': ['introduction', 'problem', 'solutions', 'comparison', 'recommendation'],
                'tone': 'persuasive'
            },
            'transactional': {
                'template': 'buying-guide',
                'structure': ['introduction', 'criteria', 'top-picks', 'buying-tips', 'conclusion'],
                'tone': 'action-oriented'
            },
            'navigational': {
                'template': 'resource-page',
                'structure': ['introduction', 'overview', 'resources', 'next-steps'],
                'tone': 'helpful'
            }
        }
    
    async def generate_brief(self, keyword: str, serp_results: List[Dict[str, Any]], 
                           cluster_data: Dict[str, Any] = None, 
                           intent: str = 'informational') -> ContentBrief:
        """Generate a comprehensive content brief for a keyword"""
        try:
            brief_id = str(uuid.uuid4())
            now = datetime.utcnow()
            
            # Analyze SERP results for content insights
            serp_analysis = await self._analyze_serp_results(serp_results)
            
            # Generate title and meta description
            title = await self._generate_title(keyword, intent, serp_analysis)
            meta_description = await self._generate_meta_description(keyword, intent, serp_analysis)
            
            # Create content outline
            outline = await self._generate_outline(keyword, intent, serp_analysis, cluster_data)
            
            # Extract FAQs from People Also Ask
            faqs = await self._extract_faqs(serp_results)
            
            # Identify entities and topics
            entities = await self._extract_entities(keyword, serp_results)
            
            # Suggest internal and external links
            internal_links = await self._suggest_internal_links(keyword, cluster_data)
            external_links = await self._suggest_external_links(serp_results)
            
            # Determine content type and audience
            content_type = self._determine_content_type(intent, serp_analysis)
            target_audience = await self._identify_target_audience(keyword, serp_analysis)
            
            # Define content goals
            content_goals = await self._define_content_goals(intent, serp_analysis)
            
            # Generate SEO notes
            seo_notes = await self._generate_seo_notes(keyword, serp_analysis, outline)
            
            brief = ContentBrief(
                id=brief_id,
                keyword=keyword,
                title=title,
                meta_description=meta_description,
                outline=outline,
                faqs=faqs,
                entities=entities,
                internal_links=internal_links,
                external_links=external_links,
                content_type=content_type,
                target_audience=target_audience,
                content_goals=content_goals,
                seo_notes=seo_notes,
                created_at=now,
                updated_at=now
            )
            
            self.logger.info(f"Generated brief for keyword: {keyword}")
            return brief
            
        except Exception as e:
            self.logger.error(f"Error generating brief for {keyword}: {e}")
            raise
    
    async def generate_brief_batch(self, keywords_data: List[Dict[str, Any]]) -> List[ContentBrief]:
        """Generate briefs for multiple keywords"""
        try:
            briefs = []
            for keyword_data in keywords_data:
                brief = await self.generate_brief(
                    keyword=keyword_data['keyword'],
                    serp_results=keyword_data.get('serp_results', []),
                    cluster_data=keyword_data.get('cluster_data'),
                    intent=keyword_data.get('intent', 'informational')
                )
                briefs.append(brief)
            
            self.logger.info(f"Generated {len(briefs)} briefs in batch")
            return briefs
            
        except Exception as e:
            self.logger.error(f"Error generating briefs in batch: {e}")
            raise
    
    async def _analyze_serp_results(self, serp_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze SERP results for content insights"""
        try:
            analysis = {
                'top_results': [],
                'common_themes': [],
                'content_gaps': [],
                'featured_snippets': [],
                'people_also_ask': [],
                'related_searches': [],
                'content_types': {},
                'average_word_count': 0,
                'common_headings': []
            }
            
            if not serp_results:
                return analysis
            
            # Analyze top results
            for result in serp_results[:5]:
                analysis['top_results'].append({
                    'title': result.get('title', ''),
                    'snippet': result.get('snippet', ''),
                    'url': result.get('url', ''),
                    'word_count': self._estimate_word_count(result.get('snippet', ''))
                })
            
            # Extract common themes from titles and snippets
            all_text = ' '.join([r.get('title', '') + ' ' + r.get('snippet', '') for r in serp_results])
            analysis['common_themes'] = await self._extract_themes(all_text)
            
            # Identify content gaps
            analysis['content_gaps'] = await self._identify_content_gaps(serp_results)
            
            # Extract featured snippets
            analysis['featured_snippets'] = [r for r in serp_results if r.get('featured_snippet')]
            
            # Extract People Also Ask
            analysis['people_also_ask'] = [r for r in serp_results if r.get('people_also_ask')]
            
            # Extract related searches
            analysis['related_searches'] = [r for r in serp_results if r.get('related_searches')]
            
            # Analyze content types
            analysis['content_types'] = self._analyze_content_types(serp_results)
            
            # Calculate average word count
            word_counts = [self._estimate_word_count(r.get('snippet', '')) for r in serp_results]
            analysis['average_word_count'] = sum(word_counts) / len(word_counts) if word_counts else 0
            
            # Extract common headings
            analysis['common_headings'] = await self._extract_common_headings(serp_results)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error analyzing SERP results: {e}")
            raise
    
    async def _generate_title(self, keyword: str, intent: str, serp_analysis: Dict[str, Any]) -> str:
        """Generate an SEO-optimized title"""
        try:
            # Get content type template
            content_type = self.content_types.get(intent, self.content_types['informational'])
            
            # Analyze top result titles for patterns
            top_titles = [r['title'] for r in serp_analysis.get('top_results', [])]
            
            # Generate title based on intent and patterns
            if intent == 'informational':
                if 'how to' in keyword.lower():
                    return f"How to {keyword.replace('how to', '').strip()}: Complete Guide"
                elif 'what is' in keyword.lower():
                    return f"What is {keyword.replace('what is', '').strip()}: Definition & Guide"
                else:
                    return f"{keyword}: Complete Guide & Tips"
            
            elif intent == 'commercial':
                return f"Best {keyword} in 2024: Top Picks & Reviews"
            
            elif intent == 'transactional':
                return f"Where to Buy {keyword}: Best Places & Deals"
            
            else:  # navigational
                return f"{keyword}: Resources & Information"
                
        except Exception as e:
            self.logger.error(f"Error generating title: {e}")
            return f"{keyword}: Complete Guide"
    
    async def _generate_meta_description(self, keyword: str, intent: str, serp_analysis: Dict[str, Any]) -> str:
        """Generate an SEO-optimized meta description"""
        try:
            # Get top snippet for inspiration
            top_snippet = serp_analysis.get('top_results', [{}])[0].get('snippet', '')
            
            # Generate description based on intent
            if intent == 'informational':
                return f"Learn everything about {keyword}. Get expert tips, step-by-step guides, and best practices. Find answers to common questions and improve your knowledge."
            
            elif intent == 'commercial':
                return f"Discover the best {keyword} options. Compare features, prices, and reviews to find the perfect solution for your needs."
            
            elif intent == 'transactional':
                return f"Find the best deals on {keyword}. Compare prices, read reviews, and get exclusive discounts. Buy with confidence."
            
            else:  # navigational
                return f"Access comprehensive {keyword} resources, tools, and information. Everything you need in one place."
                
        except Exception as e:
            self.logger.error(f"Error generating meta description: {e}")
            return f"Complete guide to {keyword}. Expert insights, tips, and resources."
    
    async def _generate_outline(self, keyword: str, intent: str, serp_analysis: Dict[str, Any], 
                               cluster_data: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Generate a detailed content outline"""
        try:
            outline = []
            content_type = self.content_types.get(intent, self.content_types['informational'])
            
            # Get structure based on content type
            structure = content_type['structure']
            
            for i, section in enumerate(structure):
                section_outline = {
                    'id': f"section_{i+1}",
                    'title': section.replace('-', ' ').title(),
                    'level': 1,
                    'content_type': section,
                    'key_points': [],
                    'subsections': [],
                    'estimated_words': 0
                }
                
                # Add key points based on section type
                if section == 'introduction':
                    section_outline['key_points'] = [
                        f"Brief overview of {keyword}",
                        "Why this topic matters",
                        "What readers will learn"
                    ]
                    section_outline['estimated_words'] = 150
                
                elif section == 'what-is':
                    section_outline['key_points'] = [
                        f"Definition of {keyword}",
                        "Key characteristics",
                        "Common misconceptions"
                    ]
                    section_outline['estimated_words'] = 200
                
                elif section == 'how-to':
                    section_outline['key_points'] = [
                        "Step-by-step process",
                        "Required tools/materials",
                        "Pro tips and best practices"
                    ]
                    section_outline['estimated_words'] = 300
                
                elif section == 'tips':
                    section_outline['key_points'] = [
                        "Expert recommendations",
                        "Common mistakes to avoid",
                        "Advanced techniques"
                    ]
                    section_outline['estimated_words'] = 250
                
                elif section == 'conclusion':
                    section_outline['key_points'] = [
                        "Summary of key points",
                        "Next steps",
                        "Call to action"
                    ]
                    section_outline['estimated_words'] = 100
                
                # Add subsections based on SERP analysis
                if serp_analysis.get('common_headings'):
                    section_outline['subsections'] = [
                        {
                            'id': f"subsection_{i+1}_{j+1}",
                            'title': heading,
                            'level': 2,
                            'estimated_words': 100
                        }
                        for j, heading in enumerate(serp_analysis['common_headings'][:3])
                    ]
                
                outline.append(section_outline)
            
            return outline
            
        except Exception as e:
            self.logger.error(f"Error generating outline: {e}")
            return []
    
    async def _extract_faqs(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract FAQs from People Also Ask and SERP results"""
        try:
            faqs = []
            
            # Extract from People Also Ask
            for result in serp_results:
                if result.get('people_also_ask'):
                    for qa in result['people_also_ask']:
                        faqs.append({
                            'question': qa.get('question', ''),
                            'answer': qa.get('answer', ''),
                            'source': 'people_also_ask'
                        })
            
            # Generate additional FAQs based on keyword
            additional_faqs = await self._generate_additional_faqs(serp_results)
            faqs.extend(additional_faqs)
            
            return faqs[:10]  # Limit to top 10 FAQs
            
        except Exception as e:
            self.logger.error(f"Error extracting FAQs: {e}")
            return []
    
    async def _extract_entities(self, keyword: str, serp_results: List[Dict[str, Any]]) -> List[str]:
        """Extract entities and topics from keyword and SERP results"""
        try:
            entities = []
            
            # Extract from keyword
            entities.extend(keyword.split())
            
            # Extract from SERP results
            all_text = ' '.join([r.get('title', '') + ' ' + r.get('snippet', '') for r in serp_results])
            
            # Simple entity extraction (in production, use NER models)
            words = all_text.lower().split()
            word_freq = {}
            for word in words:
                if len(word) > 3 and word.isalpha():
                    word_freq[word] = word_freq.get(word, 0) + 1
            
            # Get most frequent words as entities
            sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
            entities.extend([word for word, freq in sorted_words[:10]])
            
            return list(set(entities))  # Remove duplicates
            
        except Exception as e:
            self.logger.error(f"Error extracting entities: {e}")
            return []
    
    async def _suggest_internal_links(self, keyword: str, cluster_data: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Suggest internal links based on keyword clusters"""
        try:
            internal_links = []
            
            if cluster_data and cluster_data.get('related_keywords'):
                for related_keyword in cluster_data['related_keywords'][:5]:
                    internal_links.append({
                        'keyword': related_keyword,
                        'anchor_text': related_keyword,
                        'relevance_score': 0.8,
                        'link_type': 'cluster_related'
                    })
            
            return internal_links
            
        except Exception as e:
            self.logger.error(f"Error suggesting internal links: {e}")
            return []
    
    async def _suggest_external_links(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Suggest external links from SERP results"""
        try:
            external_links = []
            
            for result in serp_results[:5]:
                external_links.append({
                    'url': result.get('url', ''),
                    'title': result.get('title', ''),
                    'domain': self._extract_domain(result.get('url', '')),
                    'relevance_score': 0.9,
                    'link_type': 'serp_result'
                })
            
            return external_links
            
        except Exception as e:
            self.logger.error(f"Error suggesting external links: {e}")
            return []
    
    def _determine_content_type(self, intent: str, serp_analysis: Dict[str, Any]) -> str:
        """Determine the best content type based on intent and SERP analysis"""
        try:
            content_types = serp_analysis.get('content_types', {})
            
            if intent == 'informational':
                if content_types.get('how-to') > 0:
                    return 'how-to-guide'
                elif content_types.get('definition') > 0:
                    return 'definition-guide'
                else:
                    return 'comprehensive-guide'
            
            elif intent == 'commercial':
                if content_types.get('review') > 0:
                    return 'product-review'
                else:
                    return 'comparison-guide'
            
            elif intent == 'transactional':
                return 'buying-guide'
            
            else:  # navigational
                return 'resource-page'
                
        except Exception as e:
            self.logger.error(f"Error determining content type: {e}")
            return 'comprehensive-guide'
    
    async def _identify_target_audience(self, keyword: str, serp_analysis: Dict[str, Any]) -> str:
        """Identify the target audience for the content"""
        try:
            # Analyze SERP results for audience indicators
            all_text = ' '.join([r.get('title', '') + ' ' + r.get('snippet', '') for r in serp_analysis.get('top_results', [])])
            
            # Simple audience detection based on keywords
            if any(word in all_text.lower() for word in ['beginner', 'start', 'learn', 'guide']):
                return 'Beginners'
            elif any(word in all_text.lower() for word in ['advanced', 'expert', 'professional']):
                return 'Advanced users'
            elif any(word in all_text.lower() for word in ['business', 'enterprise', 'company']):
                return 'Business professionals'
            else:
                return 'General audience'
                
        except Exception as e:
            self.logger.error(f"Error identifying target audience: {e}")
            return 'General audience'
    
    async def _define_content_goals(self, intent: str, serp_analysis: Dict[str, Any]) -> List[str]:
        """Define content goals based on intent and SERP analysis"""
        try:
            goals = []
            
            if intent == 'informational':
                goals = [
                    "Educate readers about the topic",
                    "Provide comprehensive information",
                    "Answer common questions",
                    "Establish authority and expertise"
                ]
            
            elif intent == 'commercial':
                goals = [
                    "Help readers make informed decisions",
                    "Compare different options",
                    "Highlight product benefits",
                    "Guide readers toward purchase"
                ]
            
            elif intent == 'transactional':
                goals = [
                    "Help readers find the best deals",
                    "Provide buying guidance",
                    "Simplify the purchase process",
                    "Build trust and confidence"
                ]
            
            else:  # navigational
                goals = [
                    "Provide quick access to resources",
                    "Organize information effectively",
                    "Help users find what they need",
                    "Improve user experience"
                ]
            
            return goals
            
        except Exception as e:
            self.logger.error(f"Error defining content goals: {e}")
            return ["Provide valuable information to readers"]
    
    async def _generate_seo_notes(self, keyword: str, serp_analysis: Dict[str, Any], 
                                 outline: List[Dict[str, Any]]) -> List[str]:
        """Generate SEO notes and recommendations"""
        try:
            seo_notes = []
            
            # Keyword optimization
            seo_notes.append(f"Use '{keyword}' naturally throughout the content")
            seo_notes.append("Include keyword in H1, H2, and H3 headings")
            seo_notes.append("Optimize meta title and description")
            
            # Content structure
            seo_notes.append("Use proper heading hierarchy (H1 > H2 > H3)")
            seo_notes.append("Include internal and external links")
            seo_notes.append("Add relevant images with alt text")
            
            # Content length
            total_words = sum(section.get('estimated_words', 0) for section in outline)
            if total_words < 1000:
                seo_notes.append("Consider expanding content to 1000+ words for better SEO")
            elif total_words > 3000:
                seo_notes.append("Content is comprehensive - consider breaking into multiple articles")
            
            # Featured snippet optimization
            if serp_analysis.get('featured_snippets'):
                seo_notes.append("Optimize for featured snippets with clear, concise answers")
                seo_notes.append("Use bullet points and numbered lists")
            
            # User experience
            seo_notes.append("Improve readability with short paragraphs and clear structure")
            seo_notes.append("Include a table of contents for long articles")
            seo_notes.append("Add call-to-action elements")
            
            return seo_notes
            
        except Exception as e:
            self.logger.error(f"Error generating SEO notes: {e}")
            return ["Focus on providing valuable, well-structured content"]
    
    def _estimate_word_count(self, text: str) -> int:
        """Estimate word count from text"""
        return len(text.split())
    
    async def _extract_themes(self, text: str) -> List[str]:
        """Extract common themes from text"""
        # Simple theme extraction (in production, use topic modeling)
        words = text.lower().split()
        word_freq = {}
        for word in words:
            if len(word) > 4 and word.isalpha():
                word_freq[word] = word_freq.get(word, 0) + 1
        
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        return [word for word, freq in sorted_words[:5]]
    
    async def _identify_content_gaps(self, serp_results: List[Dict[str, Any]]) -> List[str]:
        """Identify content gaps in SERP results"""
        # Simple gap identification (in production, use more sophisticated analysis)
        gaps = []
        
        # Check for missing content types
        content_types = set()
        for result in serp_results:
            if 'how to' in result.get('title', '').lower():
                content_types.add('how-to')
            elif 'review' in result.get('title', '').lower():
                content_types.add('review')
            elif 'vs' in result.get('title', '').lower():
                content_types.add('comparison')
        
        if 'how-to' not in content_types:
            gaps.append("Step-by-step how-to guide")
        if 'comparison' not in content_types:
            gaps.append("Comparison or vs content")
        if 'review' not in content_types:
            gaps.append("Product or service reviews")
        
        return gaps
    
    def _analyze_content_types(self, serp_results: List[Dict[str, Any]]) -> Dict[str, int]:
        """Analyze content types in SERP results"""
        content_types = {
            'how-to': 0,
            'review': 0,
            'comparison': 0,
            'definition': 0,
            'list': 0
        }
        
        for result in serp_results:
            title = result.get('title', '').lower()
            if 'how to' in title or 'guide' in title:
                content_types['how-to'] += 1
            elif 'review' in title or 'best' in title:
                content_types['review'] += 1
            elif 'vs' in title or 'vs.' in title:
                content_types['comparison'] += 1
            elif 'what is' in title or 'definition' in title:
                content_types['definition'] += 1
            elif 'top' in title or 'list' in title:
                content_types['list'] += 1
        
        return content_types
    
    async def _extract_common_headings(self, serp_results: List[Dict[str, Any]]) -> List[str]:
        """Extract common headings from SERP results"""
        # This would typically use more sophisticated analysis
        # For now, return common heading patterns
        return [
            "Introduction",
            "What is",
            "How to",
            "Benefits",
            "Tips",
            "Conclusion"
        ]
    
    async def _generate_additional_faqs(self, serp_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate additional FAQs based on SERP analysis"""
        # This would use AI to generate relevant FAQs
        # For now, return common FAQ patterns
        return [
            {
                'question': 'What are the main benefits?',
                'answer': 'Benefits vary based on the specific topic and context.',
                'source': 'generated'
            },
            {
                'question': 'How do I get started?',
                'answer': 'Start by understanding the basics and following step-by-step guides.',
                'source': 'generated'
            }
        ]
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            from urllib.parse import urlparse
            return urlparse(url).netloc
        except:
            return url
