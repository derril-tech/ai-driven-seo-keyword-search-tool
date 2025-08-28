import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from workers.difficulty_worker import DifficultyWorker

@pytest.fixture
def difficulty_worker():
    return DifficultyWorker()

@pytest.mark.asyncio
async def test_calculate_difficulty_basic(difficulty_worker):
    """Test basic difficulty calculation"""
    keyword = "seo tools"
    serp_results = [
        {
            'domain_authority': 85,
            'position': 1,
            'features': ['featured_snippet'],
            'relevance': 0.9
        },
        {
            'domain_authority': 75,
            'position': 2,
            'features': ['reviews'],
            'relevance': 0.8
        }
    ]
    
    result = await difficulty_worker.calculate_difficulty(keyword, serp_results)
    
    assert isinstance(result, dict)
    assert 'difficulty_score' in result
    assert 'factors' in result
    assert 'competition_level' in result
    assert 'recommendations' in result
    
    assert 0 <= result['difficulty_score'] <= 100
    assert isinstance(result['factors'], dict)
    assert isinstance(result['recommendations'], list)

@pytest.mark.asyncio
async def test_calculate_difficulty_high_competition(difficulty_worker):
    """Test difficulty calculation for high competition keywords"""
    keyword = "digital marketing"
    serp_results = [
        {
            'domain_authority': 95,
            'position': 1,
            'features': ['featured_snippet', 'reviews'],
            'relevance': 0.95
        },
        {
            'domain_authority': 90,
            'position': 2,
            'features': ['how_to'],
            'relevance': 0.9
        },
        {
            'domain_authority': 88,
            'position': 3,
            'features': ['video'],
            'relevance': 0.85
        }
    ]
    
    result = await difficulty_worker.calculate_difficulty(keyword, serp_results)
    
    # High competition should result in high difficulty
    assert result['difficulty_score'] > 70
    assert result['competition_level'] in ['high', 'very_high']

@pytest.mark.asyncio
async def test_calculate_difficulty_low_competition(difficulty_worker):
    """Test difficulty calculation for low competition keywords"""
    keyword = "niche seo tools for small business"
    serp_results = [
        {
            'domain_authority': 45,
            'position': 1,
            'features': [],
            'relevance': 0.7
        },
        {
            'domain_authority': 35,
            'position': 2,
            'features': [],
            'relevance': 0.6
        }
    ]
    
    result = await difficulty_worker.calculate_difficulty(keyword, serp_results)
    
    # Low competition should result in low difficulty
    assert result['difficulty_score'] < 50
    assert result['competition_level'] in ['low', 'medium']

def test_calculate_domain_authority_factor(difficulty_worker):
    """Test domain authority factor calculation"""
    serp_results = [
        {'domain_authority': 90},
        {'domain_authority': 85},
        {'domain_authority': 80}
    ]
    
    factor = difficulty_worker._calculate_domain_authority_factor(serp_results)
    
    assert isinstance(factor, float)
    assert 0 <= factor <= 1
    # High authority domains should increase difficulty
    assert factor > 0.7

def test_calculate_serp_features_factor(difficulty_worker):
    """Test SERP features factor calculation"""
    serp_results = [
        {'features': ['featured_snippet', 'reviews']},
        {'features': ['how_to']},
        {'features': []}
    ]
    
    factor = difficulty_worker._calculate_serp_features_factor(serp_results)
    
    assert isinstance(factor, float)
    assert 0 <= factor <= 1
    # More features should increase difficulty
    assert factor > 0.3

def test_calculate_keyword_length_factor(difficulty_worker):
    """Test keyword length factor calculation"""
    short_keyword = "seo"
    long_keyword = "best seo tools for small business marketing agencies"
    
    short_factor = difficulty_worker._calculate_keyword_length_factor(short_keyword)
    long_factor = difficulty_worker._calculate_keyword_length_factor(long_keyword)
    
    assert isinstance(short_factor, float)
    assert isinstance(long_factor, float)
    assert 0 <= short_factor <= 1
    assert 0 <= long_factor <= 1
    
    # Longer keywords should be easier (lower difficulty)
    assert short_factor > long_factor

def test_calculate_search_volume_factor(difficulty_worker):
    """Test search volume factor calculation"""
    high_volume = 100000
    low_volume = 100
    
    high_factor = difficulty_worker._calculate_search_volume_factor(high_volume)
    low_factor = difficulty_worker._calculate_search_volume_factor(low_volume)
    
    assert isinstance(high_factor, float)
    assert isinstance(low_factor, float)
    assert 0 <= high_factor <= 1
    assert 0 <= low_factor <= 1
    
    # Higher volume should increase difficulty
    assert high_factor > low_factor

def test_calculate_competition_level(difficulty_worker):
    """Test competition level classification"""
    test_cases = [
        (20, "low"),
        (40, "medium"),
        (60, "medium"),
        (80, "high"),
        (95, "very_high")
    ]
    
    for score, expected_level in test_cases:
        level = difficulty_worker._calculate_competition_level(score)
        assert level == expected_level

def test_generate_recommendations(difficulty_worker):
    """Test recommendation generation"""
    difficulty_score = 75
    factors = {
        'domain_authority': 0.8,
        'serp_features': 0.7,
        'keyword_length': 0.3,
        'search_volume': 0.6
    }
    
    recommendations = difficulty_worker._generate_recommendations(difficulty_score, factors)
    
    assert isinstance(recommendations, list)
    assert len(recommendations) > 0
    
    for rec in recommendations:
        assert isinstance(rec, str)
        assert len(rec) > 0

@pytest.mark.asyncio
async def test_calculate_difficulty_batch(difficulty_worker):
    """Test batch difficulty calculation"""
    keywords_data = [
        {
            'keyword': 'seo tools',
            'serp_results': [{'domain_authority': 85, 'position': 1, 'features': [], 'relevance': 0.8}]
        },
        {
            'keyword': 'digital marketing',
            'serp_results': [{'domain_authority': 90, 'position': 1, 'features': ['featured_snippet'], 'relevance': 0.9}]
        }
    ]
    
    result = await difficulty_worker.calculate_difficulty_batch(keywords_data)
    
    assert isinstance(result, list)
    assert len(result) == len(keywords_data)
    
    for item in result:
        assert 'keyword' in item
        assert 'difficulty_score' in item
        assert 'factors' in item
        assert 'competition_level' in item

@pytest.mark.asyncio
async def test_calculate_difficulty_empty_serp(difficulty_worker):
    """Test difficulty calculation with empty SERP results"""
    keyword = "test keyword"
    serp_results = []
    
    result = await difficulty_worker.calculate_difficulty(keyword, serp_results)
    
    assert isinstance(result, dict)
    assert 'difficulty_score' in result
    assert 'factors' in result
    # Should handle empty results gracefully
    assert result['difficulty_score'] >= 0

@pytest.mark.asyncio
async def test_calculate_difficulty_missing_data(difficulty_worker):
    """Test difficulty calculation with missing data"""
    keyword = "test keyword"
    serp_results = [
        {
            'domain_authority': None,
            'position': 1,
            'features': [],
            'relevance': 0.5
        }
    ]
    
    result = await difficulty_worker.calculate_difficulty(keyword, serp_results)
    
    assert isinstance(result, dict)
    assert 'difficulty_score' in result
    # Should handle missing data gracefully
    assert result['difficulty_score'] >= 0

def test_domain_authority_factor_edge_cases(difficulty_worker):
    """Test domain authority factor with edge cases"""
    # Empty results
    factor = difficulty_worker._calculate_domain_authority_factor([])
    assert factor == 0
    
    # All high authority
    high_auth_results = [{'domain_authority': 95} for _ in range(5)]
    factor = difficulty_worker._calculate_domain_authority_factor(high_auth_results)
    assert factor > 0.8
    
    # All low authority
    low_auth_results = [{'domain_authority': 20} for _ in range(5)]
    factor = difficulty_worker._calculate_domain_authority_factor(low_auth_results)
    assert factor < 0.3

def test_serp_features_factor_edge_cases(difficulty_worker):
    """Test SERP features factor with edge cases"""
    # No features
    no_features = [{'features': []} for _ in range(3)]
    factor = difficulty_worker._calculate_serp_features_factor(no_features)
    assert factor < 0.2
    
    # Many features
    many_features = [{'features': ['featured_snippet', 'reviews', 'how_to', 'video']} for _ in range(3)]
    factor = difficulty_worker._calculate_serp_features_factor(many_features)
    assert factor > 0.7

def test_keyword_length_factor_edge_cases(difficulty_worker):
    """Test keyword length factor with edge cases"""
    # Very short keyword
    factor = difficulty_worker._calculate_keyword_length_factor("a")
    assert factor > 0.8
    
    # Very long keyword
    long_keyword = "best seo tools for small business marketing agencies in 2024 with reviews and comparisons"
    factor = difficulty_worker._calculate_keyword_length_factor(long_keyword)
    assert factor < 0.3

def test_search_volume_factor_edge_cases(difficulty_worker):
    """Test search volume factor with edge cases"""
    # Zero volume
    factor = difficulty_worker._calculate_search_volume_factor(0)
    assert factor == 0
    
    # Very high volume
    factor = difficulty_worker._calculate_search_volume_factor(1000000)
    assert factor > 0.9

@pytest.mark.asyncio
async def test_difficulty_calculation_consistency(difficulty_worker):
    """Test that difficulty calculation is consistent"""
    keyword = "seo tools"
    serp_results = [
        {
            'domain_authority': 85,
            'position': 1,
            'features': ['featured_snippet'],
            'relevance': 0.8
        }
    ]
    
    # Run multiple times
    results = []
    for _ in range(3):
        result = await difficulty_worker.calculate_difficulty(keyword, serp_results)
        results.append(result['difficulty_score'])
    
    # Should be consistent (within small tolerance)
    assert max(results) - min(results) < 5

def test_factors_contribution(difficulty_worker):
    """Test that all factors contribute to final score"""
    keyword = "test keyword"
    serp_results = [
        {
            'domain_authority': 85,
            'position': 1,
            'features': ['featured_snippet'],
            'relevance': 0.8
        }
    ]
    
    # Test individual factors
    domain_factor = difficulty_worker._calculate_domain_authority_factor(serp_results)
    features_factor = difficulty_worker._calculate_serp_features_factor(serp_results)
    length_factor = difficulty_worker._calculate_keyword_length_factor(keyword)
    
    # All factors should contribute
    assert domain_factor > 0
    assert features_factor > 0
    assert length_factor > 0

@pytest.mark.asyncio
async def test_recommendations_relevance(difficulty_worker):
    """Test that recommendations are relevant to difficulty level"""
    # High difficulty
    high_difficulty = 85
    high_factors = {
        'domain_authority': 0.9,
        'serp_features': 0.8,
        'keyword_length': 0.2,
        'search_volume': 0.7
    }
    
    high_recs = difficulty_worker._generate_recommendations(high_difficulty, high_factors)
    
    # Should suggest long-tail alternatives
    assert any('long-tail' in rec.lower() or 'niche' in rec.lower() for rec in high_recs)
    
    # Low difficulty
    low_difficulty = 25
    low_factors = {
        'domain_authority': 0.3,
        'serp_features': 0.2,
        'keyword_length': 0.8,
        'search_volume': 0.2
    }
    
    low_recs = difficulty_worker._generate_recommendations(low_difficulty, low_factors)
    
    # Should suggest optimization strategies
    assert any('optimize' in rec.lower() or 'content' in rec.lower() for rec in low_recs)

@pytest.mark.asyncio
async def test_error_handling_factor_calculation(difficulty_worker):
    """Test error handling in factor calculations"""
    with patch.object(difficulty_worker, '_calculate_domain_authority_factor', side_effect=Exception("Factor error")):
        keyword = "test keyword"
        serp_results = [{'domain_authority': 85, 'position': 1, 'features': [], 'relevance': 0.8}]
        
        # Should handle errors gracefully
        result = await difficulty_worker.calculate_difficulty(keyword, serp_results)
        
        assert isinstance(result, dict)
        assert 'difficulty_score' in result
        assert result['difficulty_score'] >= 0

if __name__ == "__main__":
    pytest.main([__file__])
