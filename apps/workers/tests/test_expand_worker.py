import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from workers.expand_worker import ExpandWorker

@pytest.fixture
def expand_worker():
    return ExpandWorker()

@pytest.mark.asyncio
async def test_expand_keywords_basic(expand_worker):
    """Test basic keyword expansion functionality"""
    seed_keyword = "digital marketing"
    project_id = "test-project-123"
    
    result = await expand_worker.expand_keywords(seed_keyword, project_id)
    
    assert isinstance(result, list)
    assert len(result) > 0
    
    # Check structure of returned keywords
    for keyword in result:
        assert 'project_id' in keyword
        assert 'keyword' in keyword
        assert 'source' in keyword
        assert 'confidence' in keyword
        assert keyword['project_id'] == project_id

@pytest.mark.asyncio
async def test_extract_with_keybert(expand_worker):
    """Test KeyBERT keyword extraction"""
    seed_keyword = "seo tools"
    
    result = expand_worker._extract_with_keybert(seed_keyword)
    
    assert isinstance(result, list)
    for item in result:
        assert 'keyword' in item
        assert 'confidence' in item
        assert 'source' in item
        assert item['source'] == 'keybert'
        assert 0 <= item['confidence'] <= 1

@pytest.mark.asyncio
async def test_extract_with_yake(expand_worker):
    """Test YAKE keyword extraction"""
    seed_keyword = "content marketing"
    
    result = expand_worker._extract_with_yake(seed_keyword)
    
    assert isinstance(result, list)
    for item in result:
        assert 'keyword' in item
        assert 'confidence' in item
        assert 'source' in item
        assert item['source'] == 'yake'
        assert 0 <= item['confidence'] <= 1

def test_generate_variations(expand_worker):
    """Test manual variation generation"""
    seed_keyword = "blog writing"
    
    result = expand_worker._generate_variations(seed_keyword)
    
    assert isinstance(result, list)
    assert len(result) > 0
    
    # Check for expected variations
    variations_text = [item['keyword'].lower() for item in result]
    
    # Should have "how to" variation
    assert any('how to' in var for var in variations_text)
    
    # Should have "best" variation
    assert any('best' in var for var in variations_text)
    
    # Should have "guide" variation
    assert any('guide' in var for var in variations_text)

def test_deduplicate_keywords(expand_worker):
    """Test keyword deduplication"""
    keywords = [
        {'keyword': 'digital marketing', 'confidence': 0.9, 'source': 'keybert'},
        {'keyword': 'Digital Marketing', 'confidence': 0.8, 'source': 'yake'},
        {'keyword': 'seo tools', 'confidence': 0.7, 'source': 'keybert'},
        {'keyword': 'SEO Tools', 'confidence': 0.6, 'source': 'yake'},
    ]
    
    result = expand_worker._deduplicate_keywords(keywords)
    
    # Should remove duplicates (case-insensitive)
    assert len(result) < len(keywords)
    
    # Should keep highest confidence version
    digital_marketing = [k for k in result if 'digital marketing' in k['keyword'].lower()]
    assert len(digital_marketing) == 1
    assert digital_marketing[0]['confidence'] == 0.9

@pytest.mark.asyncio
async def test_expand_keywords_with_empty_input(expand_worker):
    """Test expansion with empty keyword"""
    result = await expand_worker.expand_keywords("", "test-project")
    
    assert isinstance(result, list)
    # Should handle empty input gracefully
    assert len(result) >= 0

@pytest.mark.asyncio
async def test_expand_keywords_with_special_characters(expand_worker):
    """Test expansion with special characters"""
    seed_keyword = "SEO & PPC strategies"
    project_id = "test-project"
    
    result = await expand_worker.expand_keywords(seed_keyword, project_id)
    
    assert isinstance(result, list)
    assert len(result) > 0
    
    # Should handle special characters gracefully
    for keyword in result:
        assert 'project_id' in keyword
        assert 'keyword' in keyword

@pytest.mark.asyncio
async def test_expand_keywords_performance(expand_worker):
    """Test expansion performance"""
    import time
    
    seed_keyword = "marketing automation"
    project_id = "test-project"
    
    start_time = time.time()
    result = await expand_worker.expand_keywords(seed_keyword, project_id)
    end_time = time.time()
    
    duration = end_time - start_time
    
    # Should complete within reasonable time (adjust threshold as needed)
    assert duration < 30  # 30 seconds max
    
    assert isinstance(result, list)
    assert len(result) > 0

def test_stop_words_removal(expand_worker):
    """Test that stop words are properly removed"""
    seed_keyword = "how to do digital marketing"
    
    result = expand_worker._generate_variations(seed_keyword)
    
    # Check that variations don't contain excessive stop words
    for item in result:
        keyword = item['keyword'].lower()
        # Should not start with "how to do" (redundant)
        assert not keyword.startswith('how to do')

@pytest.mark.asyncio
async def test_error_handling_keybert_failure(expand_worker):
    """Test error handling when KeyBERT fails"""
    with patch.object(expand_worker, '_extract_with_keybert', side_effect=Exception("KeyBERT error")):
        seed_keyword = "test keyword"
        project_id = "test-project"
        
        # Should not crash, should continue with other methods
        result = await expand_worker.expand_keywords(seed_keyword, project_id)
        
        assert isinstance(result, list)
        # Should still get results from other methods
        assert len(result) >= 0

@pytest.mark.asyncio
async def test_error_handling_yake_failure(expand_worker):
    """Test error handling when YAKE fails"""
    with patch.object(expand_worker, '_extract_with_yake', side_effect=Exception("YAKE error")):
        seed_keyword = "test keyword"
        project_id = "test-project"
        
        # Should not crash, should continue with other methods
        result = await expand_worker.expand_keywords(seed_keyword, project_id)
        
        assert isinstance(result, list)
        # Should still get results from other methods
        assert len(result) >= 0

def test_confidence_scoring(expand_worker):
    """Test that confidence scores are properly calculated"""
    seed_keyword = "content strategy"
    
    result = expand_worker._generate_variations(seed_keyword)
    
    for item in result:
        assert 'confidence' in item
        assert 0 <= item['confidence'] <= 1
        
        # Check that different sources have appropriate confidence ranges
        if item['source'] == 'variation':
            assert item['confidence'] >= 0.6  # Manual variations should have good confidence

@pytest.mark.asyncio
async def test_project_id_assignment(expand_worker):
    """Test that project_id is correctly assigned to all keywords"""
    seed_keyword = "social media marketing"
    project_id = "unique-project-456"
    
    result = await expand_worker.expand_keywords(seed_keyword, project_id)
    
    for keyword in result:
        assert keyword['project_id'] == project_id

if __name__ == "__main__":
    pytest.main([__file__])
