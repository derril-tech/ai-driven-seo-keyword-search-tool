import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from workers.serp_feature_parser import SerpFeatureParser

@pytest.fixture
def serp_parser():
    return SerpFeatureParser()

@pytest.fixture
def sample_serp_results():
    return [
        {
            'title': 'Best SEO Tools 2024 - Top 10 Reviewed',
            'snippet': 'Compare the best SEO tools for your business needs. Find pricing, features, and reviews.',
            'url': 'https://example.com/seo-tools',
            'position': 1,
            'features': ['featured_snippet', 'reviews']
        },
        {
            'title': 'How to Do SEO: Complete Guide for Beginners',
            'snippet': 'Learn step-by-step SEO techniques to improve your website ranking. Follow our comprehensive guide.',
            'url': 'https://guide.com/seo-guide',
            'position': 2,
            'features': ['how_to']
        },
        {
            'title': 'SEO Services - Professional Optimization',
            'snippet': 'Get professional SEO services to boost your website traffic and rankings.',
            'url': 'https://services.com/seo',
            'position': 3,
            'features': []
        }
    ]

@pytest.mark.asyncio
async def test_parse_serp_features_basic(serp_parser, sample_serp_results):
    """Test basic SERP feature parsing"""
    result = await serp_parser.parse_serp_features(sample_serp_results)
    
    assert isinstance(result, dict)
    assert 'features' in result
    assert 'content_types' in result
    assert 'intent_signals' in result
    assert 'competition_analysis' in result
    
    features = result['features']
    assert isinstance(features, list)
    assert len(features) > 0

@pytest.mark.asyncio
async def test_extract_featured_snippets(serp_parser, sample_serp_results):
    """Test featured snippet extraction"""
    snippets = serp_parser._extract_featured_snippets(sample_serp_results)
    
    assert isinstance(snippets, list)
    
    # Check if featured snippets are found
    for snippet in snippets:
        assert 'title' in snippet
        assert 'snippet' in snippet
        assert 'position' in snippet

@pytest.mark.asyncio
async def test_extract_people_also_ask(serp_parser, sample_serp_results):
    """Test People Also Ask extraction"""
    questions = serp_parser._extract_people_also_ask(sample_serp_results)
    
    assert isinstance(questions, list)
    
    # Should return relevant questions
    for question in questions:
        assert isinstance(question, str)
        assert len(question) > 0

@pytest.mark.asyncio
async def test_extract_local_packs(serp_parser, sample_serp_results):
    """Test local pack extraction"""
    local_packs = serp_parser._extract_local_packs(sample_serp_results)
    
    assert isinstance(local_packs, list)
    
    # Should return local business listings if present
    for pack in local_packs:
        assert 'business_name' in pack
        assert 'address' in pack
        assert 'rating' in pack

@pytest.mark.asyncio
async def test_extract_video_results(serp_parser, sample_serp_results):
    """Test video result extraction"""
    videos = serp_parser._extract_video_results(sample_serp_results)
    
    assert isinstance(videos, list)
    
    # Should return video information if present
    for video in videos:
        assert 'title' in video
        assert 'url' in video
        assert 'duration' in video

@pytest.mark.asyncio
async def test_extract_shopping_results(serp_parser, sample_serp_results):
    """Test shopping result extraction"""
    shopping = serp_parser._extract_shopping_results(sample_serp_results)
    
    assert isinstance(shopping, list)
    
    # Should return shopping information if present
    for item in shopping:
        assert 'title' in item
        assert 'price' in item
        assert 'store' in item

@pytest.mark.asyncio
async def test_analyze_content_types(serp_parser, sample_serp_results):
    """Test content type analysis"""
    content_types = serp_parser._analyze_content_types(sample_serp_results)
    
    assert isinstance(content_types, dict)
    assert 'how_to' in content_types
    assert 'review' in content_types
    assert 'service' in content_types
    assert 'blog' in content_types
    
    # Should count content types
    for content_type, count in content_types.items():
        assert isinstance(count, int)
        assert count >= 0

@pytest.mark.asyncio
async def test_analyze_intent_signals(serp_parser, sample_serp_results):
    """Test intent signal analysis"""
    intent_signals = serp_parser._analyze_intent_signals(sample_serp_results)
    
    assert isinstance(intent_signals, dict)
    assert 'informational' in intent_signals
    assert 'commercial' in intent_signals
    assert 'transactional' in intent_signals
    assert 'navigational' in intent_signals
    assert 'local' in intent_signals
    
    # Should have signal strengths
    for intent, strength in intent_signals.items():
        assert isinstance(strength, float)
        assert 0 <= strength <= 1

@pytest.mark.asyncio
async def test_analyze_competition(serp_parser, sample_serp_results):
    """Test competition analysis"""
    competition = serp_parser._analyze_competition(sample_serp_results)
    
    assert isinstance(competition, dict)
    assert 'domain_authority_avg' in competition
    assert 'feature_richness' in competition
    assert 'content_quality' in competition
    assert 'competition_level' in competition
    
    # Should have meaningful metrics
    assert 0 <= competition['domain_authority_avg'] <= 100
    assert 0 <= competition['feature_richness'] <= 1
    assert 0 <= competition['content_quality'] <= 1

@pytest.mark.asyncio
async def test_extract_schema_markup(serp_parser, sample_serp_results):
    """Test schema markup extraction"""
    schema = serp_parser._extract_schema_markup(sample_serp_results)
    
    assert isinstance(schema, list)
    
    # Should return schema information if present
    for markup in schema:
        assert 'type' in markup
        assert 'data' in markup

@pytest.mark.asyncio
async def test_parse_serp_features_empty_input(serp_parser):
    """Test parsing with empty input"""
    result = await serp_parser.parse_serp_features([])
    
    assert isinstance(result, dict)
    assert 'features' in result
    assert 'content_types' in result
    assert 'intent_signals' in result
    assert 'competition_analysis' in result
    
    # Should handle empty input gracefully
    assert len(result['features']) == 0

@pytest.mark.asyncio
async def test_parse_serp_features_missing_data(serp_parser):
    """Test parsing with missing data"""
    incomplete_results = [
        {
            'title': 'Test Title',
            'snippet': 'Test snippet',
            'position': 1
            # Missing features, url, etc.
        }
    ]
    
    result = await serp_parser.parse_serp_features(incomplete_results)
    
    assert isinstance(result, dict)
    # Should handle missing data gracefully
    assert 'features' in result

def test_detect_content_type_from_title(serp_parser):
    """Test content type detection from title"""
    test_cases = [
        ("How to Do SEO", "how_to"),
        ("Best SEO Tools", "review"),
        ("SEO Services", "service"),
        ("SEO Course", "course"),
        ("SEO Blog", "blog"),
    ]
    
    for title, expected_type in test_cases:
        detected_type = serp_parser._detect_content_type_from_title(title)
        assert detected_type == expected_type

def test_detect_intent_from_title(serp_parser):
    """Test intent detection from title"""
    test_cases = [
        ("How to Do SEO", "informational"),
        ("Best SEO Tools", "commercial"),
        ("Buy SEO Software", "transactional"),
        ("Google Analytics", "navigational"),
        ("SEO Services Near Me", "local"),
    ]
    
    for title, expected_intent in test_cases:
        detected_intent = serp_parser._detect_intent_from_title(title)
        assert detected_intent == expected_intent

def test_calculate_domain_authority(serp_parser):
    """Test domain authority calculation"""
    test_domains = [
        "google.com",
        "example.com",
        "small-blog.com",
        "new-site.org"
    ]
    
    for domain in test_domains:
        authority = serp_parser._calculate_domain_authority(domain)
        assert isinstance(authority, int)
        assert 0 <= authority <= 100

def test_calculate_feature_richness(serp_parser, sample_serp_results):
    """Test feature richness calculation"""
    richness = serp_parser._calculate_feature_richness(sample_serp_results)
    
    assert isinstance(richness, float)
    assert 0 <= richness <= 1

def test_calculate_content_quality(serp_parser, sample_serp_results):
    """Test content quality calculation"""
    quality = serp_parser._calculate_content_quality(sample_serp_results)
    
    assert isinstance(quality, float)
    assert 0 <= quality <= 1

@pytest.mark.asyncio
async def test_extract_related_searches(serp_parser, sample_serp_results):
    """Test related searches extraction"""
    related = serp_parser._extract_related_searches(sample_serp_results)
    
    assert isinstance(related, list)
    
    for search in related:
        assert isinstance(search, str)
        assert len(search) > 0

@pytest.mark.asyncio
async def test_extract_knowledge_graph(serp_parser, sample_serp_results):
    """Test knowledge graph extraction"""
    knowledge = serp_parser._extract_knowledge_graph(sample_serp_results)
    
    assert isinstance(knowledge, dict)
    
    if knowledge:  # If knowledge graph data is present
        assert 'title' in knowledge
        assert 'description' in knowledge

@pytest.mark.asyncio
async def test_parse_serp_features_performance(serp_parser, sample_serp_results):
    """Test parsing performance"""
    import time
    
    start_time = time.time()
    result = await serp_parser.parse_serp_features(sample_serp_results)
    end_time = time.time()
    
    duration = end_time - start_time
    
    # Should complete within reasonable time
    assert duration < 5  # 5 seconds max
    
    assert isinstance(result, dict)
    assert 'features' in result

def test_content_type_detection_accuracy(serp_parser):
    """Test content type detection accuracy"""
    test_cases = [
        ("How to Do SEO", "how_to"),
        ("Best SEO Tools 2024", "review"),
        ("SEO Services", "service"),
        ("SEO Course Online", "course"),
        ("SEO Blog Post", "blog"),
        ("SEO Tutorial", "how_to"),
        ("Top SEO Software", "review"),
    ]
    
    for title, expected_type in test_cases:
        detected_type = serp_parser._detect_content_type_from_title(title)
        assert detected_type == expected_type

def test_intent_detection_accuracy(serp_parser):
    """Test intent detection accuracy"""
    test_cases = [
        ("How to Do SEO", "informational"),
        ("Best SEO Tools", "commercial"),
        ("Buy SEO Software", "transactional"),
        ("Google Analytics", "navigational"),
        ("SEO Services Near Me", "local"),
        ("What is SEO", "informational"),
        ("SEO Software Download", "transactional"),
    ]
    
    for title, expected_intent in test_cases:
        detected_intent = serp_parser._detect_intent_from_title(title)
        assert detected_intent == expected_intent

@pytest.mark.asyncio
async def test_error_handling_feature_extraction(serp_parser):
    """Test error handling in feature extraction"""
    with patch.object(serp_parser, '_extract_featured_snippets', side_effect=Exception("Feature error")):
        sample_results = [{'title': 'test', 'snippet': 'test'}]
        
        # Should handle errors gracefully
        result = await serp_parser.parse_serp_features(sample_results)
        
        assert isinstance(result, dict)
        assert 'features' in result

@pytest.mark.asyncio
async def test_error_handling_content_analysis(serp_parser):
    """Test error handling in content analysis"""
    with patch.object(serp_parser, '_analyze_content_types', side_effect=Exception("Content error")):
        sample_results = [{'title': 'test', 'snippet': 'test'}]
        
        # Should handle errors gracefully
        result = await serp_parser.parse_serp_features(sample_results)
        
        assert isinstance(result, dict)
        assert 'content_types' in result

def test_domain_authority_distribution(serp_parser):
    """Test domain authority distribution"""
    test_domains = [
        "google.com",
        "facebook.com",
        "amazon.com",
        "example.com",
        "small-blog.com",
        "new-site.org"
    ]
    
    authorities = []
    for domain in test_domains:
        authority = serp_parser._calculate_domain_authority(domain)
        authorities.append(authority)
    
    # Well-known domains should have higher authority
    assert serp_parser._calculate_domain_authority("google.com") > 50
    assert serp_parser._calculate_domain_authority("small-blog.com") < 50

@pytest.mark.asyncio
async def test_feature_extraction_completeness(serp_parser, sample_serp_results):
    """Test that all expected features are extracted"""
    result = await serp_parser.parse_serp_features(sample_serp_results)
    
    features = result['features']
    feature_types = [feature['type'] for feature in features]
    
    # Should extract various feature types
    expected_types = ['featured_snippet', 'how_to', 'reviews', 'local_pack', 'video', 'shopping']
    
    # Check that at least some expected features are found
    found_types = [t for t in expected_types if t in feature_types]
    assert len(found_types) > 0

@pytest.mark.asyncio
async def test_competition_analysis_accuracy(serp_parser, sample_serp_results):
    """Test competition analysis accuracy"""
    result = await serp_parser.parse_serp_features(sample_serp_results)
    
    competition = result['competition_analysis']
    
    # Should have reasonable competition metrics
    assert 0 <= competition['domain_authority_avg'] <= 100
    assert 0 <= competition['feature_richness'] <= 1
    assert 0 <= competition['content_quality'] <= 1
    
    # Competition level should be a valid string
    assert competition['competition_level'] in ['low', 'medium', 'high', 'very_high']

if __name__ == "__main__":
    pytest.main([__file__])
