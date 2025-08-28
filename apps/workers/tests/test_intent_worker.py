import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from workers.intent_worker import IntentWorker

@pytest.fixture
def intent_worker():
    return IntentWorker()

@pytest.mark.asyncio
async def test_classify_intent_basic(intent_worker):
    """Test basic intent classification"""
    keyword = "how to do seo"
    
    result = await intent_worker.classify_intent(keyword)
    
    assert isinstance(result, dict)
    assert 'intent' in result
    assert 'confidence' in result
    assert 'scores' in result
    assert result['intent'] in ['informational', 'commercial', 'transactional', 'navigational', 'local']
    assert 0 <= result['confidence'] <= 1

@pytest.mark.asyncio
async def test_informational_intent(intent_worker):
    """Test informational intent detection"""
    keywords = [
        "how to do seo",
        "what is digital marketing",
        "guide to content marketing",
        "learn about social media",
        "tutorial on email marketing"
    ]
    
    for keyword in keywords:
        result = await intent_worker.classify_intent(keyword)
        assert result['intent'] == 'informational'
        assert result['confidence'] > 0.5

@pytest.mark.asyncio
async def test_commercial_intent(intent_worker):
    """Test commercial intent detection"""
    keywords = [
        "best seo tools",
        "top digital marketing software",
        "compare email marketing platforms",
        "seo services reviews",
        "marketing automation solutions"
    ]
    
    for keyword in keywords:
        result = await intent_worker.classify_intent(keyword)
        assert result['intent'] == 'commercial'
        assert result['confidence'] > 0.5

@pytest.mark.asyncio
async def test_transactional_intent(intent_worker):
    """Test transactional intent detection"""
    keywords = [
        "buy seo tools",
        "purchase digital marketing course",
        "order content marketing services",
        "seo software download",
        "hire seo consultant"
    ]
    
    for keyword in keywords:
        result = await intent_worker.classify_intent(keyword)
        assert result['intent'] == 'transactional'
        assert result['confidence'] > 0.5

@pytest.mark.asyncio
async def test_navigational_intent(intent_worker):
    """Test navigational intent detection"""
    keywords = [
        "google analytics",
        "semrush login",
        "mailchimp dashboard",
        "hubspot crm",
        "wordpress admin"
    ]
    
    for keyword in keywords:
        result = await intent_worker.classify_intent(keyword)
        assert result['intent'] == 'navigational'
        assert result['confidence'] > 0.5

@pytest.mark.asyncio
async def test_local_intent(intent_worker):
    """Test local intent detection"""
    keywords = [
        "seo services near me",
        "digital marketing agency london",
        "content marketing consultant nyc",
        "seo expert boston",
        "marketing agency san francisco"
    ]
    
    for keyword in keywords:
        result = await intent_worker.classify_intent(keyword)
        assert result['intent'] == 'local'
        assert result['confidence'] > 0.5

def test_analyze_keyword_patterns(intent_worker):
    """Test keyword pattern analysis"""
    keyword = "best seo tools for small business"
    
    result = intent_worker._analyze_keyword_patterns(keyword)
    
    assert isinstance(result, dict)
    assert 'informational' in result
    assert 'commercial' in result
    assert 'transactional' in result
    assert 'navigational' in result
    assert 'local' in result
    
    # All scores should be between 0 and 1
    for score in result.values():
        assert 0 <= score <= 1

def test_analyze_serp_results(intent_worker):
    """Test SERP results analysis"""
    serp_results = [
        {
            'title': 'Best SEO Tools 2024 - Top 10 Reviewed',
            'snippet': 'Compare the best SEO tools for your business needs. Find pricing, features, and reviews.',
            'domain': 'seotools.com',
            'features': ['featured_snippet', 'reviews']
        },
        {
            'title': 'How to Choose SEO Tools - Complete Guide',
            'snippet': 'Learn how to select the right SEO tools for your marketing strategy.',
            'domain': 'marketingguide.com',
            'features': ['how_to']
        }
    ]
    
    result = intent_worker._analyze_serp_results(serp_results)
    
    assert isinstance(result, dict)
    assert 'informational' in result
    assert 'commercial' in result
    assert 'transactional' in result
    assert 'navigational' in result
    assert 'local' in result
    
    # All scores should be between 0 and 1
    for score in result.values():
        assert 0 <= score <= 1

@pytest.mark.asyncio
async def test_classify_batch(intent_worker):
    """Test batch intent classification"""
    keywords = [
        "how to do seo",
        "best seo tools",
        "buy seo software",
        "google analytics",
        "seo services near me"
    ]
    
    result = await intent_worker.classify_batch(keywords)
    
    assert isinstance(result, list)
    assert len(result) == len(keywords)
    
    for item in result:
        assert 'keyword' in item
        assert 'intent' in item
        assert 'confidence' in item
        assert 'scores' in item

def test_get_intent_description(intent_worker):
    """Test intent description retrieval"""
    intents = ['informational', 'commercial', 'transactional', 'navigational', 'local']
    
    for intent in intents:
        description = intent_worker.get_intent_description(intent)
        assert isinstance(description, str)
        assert len(description) > 0

@pytest.mark.asyncio
async def test_classify_intent_with_serp_results(intent_worker):
    """Test intent classification with SERP results"""
    keyword = "seo tools"
    serp_results = [
        {
            'title': 'Best SEO Tools 2024 - Top 10 Reviewed',
            'snippet': 'Compare the best SEO tools for your business needs.',
            'domain': 'seotools.com',
            'features': ['featured_snippet', 'reviews']
        }
    ]
    
    result = await intent_worker.classify_intent(keyword, serp_results)
    
    assert isinstance(result, dict)
    assert 'intent' in result
    assert 'confidence' in result
    assert 'scores' in result

@pytest.mark.asyncio
async def test_classify_intent_empty_keyword(intent_worker):
    """Test intent classification with empty keyword"""
    result = await intent_worker.classify_intent("")
    
    assert isinstance(result, dict)
    assert 'intent' in result
    assert 'confidence' in result
    # Should handle empty input gracefully

@pytest.mark.asyncio
async def test_classify_intent_special_characters(intent_worker):
    """Test intent classification with special characters"""
    keyword = "SEO & PPC tools 2024!"
    
    result = await intent_worker.classify_intent(keyword)
    
    assert isinstance(result, dict)
    assert 'intent' in result
    assert 'confidence' in result
    # Should handle special characters gracefully

def test_intent_patterns_comprehensive(intent_worker):
    """Test comprehensive intent pattern matching"""
    test_cases = [
        ("how to", "informational"),
        ("what is", "informational"),
        ("guide", "informational"),
        ("best", "commercial"),
        ("top", "commercial"),
        ("compare", "commercial"),
        ("buy", "transactional"),
        ("purchase", "transactional"),
        ("download", "transactional"),
        ("login", "navigational"),
        ("dashboard", "navigational"),
        ("near me", "local"),
        ("london", "local"),
        ("nyc", "local")
    ]
    
    for keyword, expected_intent in test_cases:
        scores = intent_worker._analyze_keyword_patterns(keyword)
        # The expected intent should have a higher score
        assert scores[expected_intent] > 0.1

def test_modifiers_impact(intent_worker):
    """Test that modifiers affect intent scores"""
    base_keyword = "seo tools"
    modified_keywords = [
        "best seo tools",  # Should increase commercial
        "how to use seo tools",  # Should increase informational
        "buy seo tools",  # Should increase transactional
        "seo tools near me",  # Should increase local
    ]
    
    base_scores = intent_worker._analyze_keyword_patterns(base_keyword)
    
    for modified_keyword in modified_keywords:
        modified_scores = intent_worker._analyze_keyword_patterns(modified_keyword)
        
        # Scores should be different from base
        assert modified_scores != base_scores

@pytest.mark.asyncio
async def test_confidence_calculation(intent_worker):
    """Test confidence score calculation"""
    keyword = "best seo tools for small business"
    
    result = await intent_worker.classify_intent(keyword)
    
    assert 0 <= result['confidence'] <= 1
    
    # If one intent is clearly dominant, confidence should be high
    scores = result['scores']
    max_score = max(scores.values())
    if max_score > 0.7:
        assert result['confidence'] > 0.6

@pytest.mark.asyncio
async def test_error_handling_pattern_analysis(intent_worker):
    """Test error handling in pattern analysis"""
    with patch.object(intent_worker, '_analyze_keyword_patterns', side_effect=Exception("Pattern analysis error")):
        keyword = "test keyword"
        
        # Should handle errors gracefully
        result = await intent_worker.classify_intent(keyword)
        
        assert isinstance(result, dict)
        assert 'intent' in result
        assert 'confidence' in result

@pytest.mark.asyncio
async def test_error_handling_serp_analysis(intent_worker):
    """Test error handling in SERP analysis"""
    with patch.object(intent_worker, '_analyze_serp_results', side_effect=Exception("SERP analysis error")):
        keyword = "test keyword"
        serp_results = [{'title': 'test', 'snippet': 'test'}]
        
        # Should handle errors gracefully
        result = await intent_worker.classify_intent(keyword, serp_results)
        
        assert isinstance(result, dict)
        assert 'intent' in result
        assert 'confidence' in result

def test_unknown_intent_handling(intent_worker):
    """Test handling of unknown intent types"""
    # Test with a keyword that doesn't clearly match any pattern
    keyword = "xyz123"
    
    scores = intent_worker._analyze_keyword_patterns(keyword)
    
    # Should return valid scores even for unknown patterns
    assert isinstance(scores, dict)
    for score in scores.values():
        assert 0 <= score <= 1

if __name__ == "__main__":
    pytest.main([__file__])
