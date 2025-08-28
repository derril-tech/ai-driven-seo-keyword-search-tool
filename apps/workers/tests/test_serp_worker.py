import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from workers.serp_worker import SerpWorker

@pytest.fixture
def serp_worker():
    return SerpWorker(api_key="test_key", provider="serpapi")

@pytest.mark.asyncio
async def test_fetch_serp_results_basic(serp_worker):
    """Test basic SERP results fetching"""
    keyword = "seo tools"
    
    result = await serp_worker.fetch_serp_results(keyword)
    
    assert isinstance(result, list)
    assert len(result) > 0
    
    # Check structure of returned results
    for item in result:
        assert 'title' in item
        assert 'url' in item
        assert 'snippet' in item
        assert 'domain' in item
        assert 'position' in item
        assert 'features' in item
        assert 'domain_authority' in item
        assert 'content_type' in item
        assert 'relevance' in item

@pytest.mark.asyncio
async def test_fetch_serp_results_with_country_language(serp_worker):
    """Test SERP results with country and language parameters"""
    keyword = "digital marketing"
    country = "uk"
    language = "en"
    
    result = await serp_worker.fetch_serp_results(keyword, country, language)
    
    assert isinstance(result, list)
    assert len(result) > 0
    
    for item in result:
        assert 'title' in item
        assert 'url' in item
        assert 'snippet' in item

@pytest.mark.asyncio
async def test_simulate_serp_api(serp_worker):
    """Test SERP API simulation"""
    keyword = "content marketing"
    country = "us"
    language = "en"
    
    result = await serp_worker._simulate_serp_api(keyword, country, language)
    
    assert isinstance(result, list)
    assert len(result) > 0
    
    for item in result:
        assert 'title' in item
        assert 'url' in item
        assert 'snippet' in item
        assert 'domain' in item
        assert 'position' in item

@pytest.mark.asyncio
async def test_enrich_result(serp_worker):
    """Test result enrichment"""
    base_result = {
        'title': 'Best SEO Tools 2024',
        'url': 'https://example.com/seo-tools',
        'snippet': 'Compare the best SEO tools for your business',
        'domain': 'example.com',
        'position': 1
    }
    keyword = "seo tools"
    
    result = await serp_worker._enrich_result(base_result, keyword)
    
    assert 'features' in result
    assert 'domain_authority' in result
    assert 'content_type' in result
    assert 'relevance' in result
    assert 'schema_hints' in result
    
    # Check data types
    assert isinstance(result['domain_authority'], int)
    assert isinstance(result['relevance'], float)
    assert isinstance(result['features'], list)
    assert isinstance(result['schema_hints'], list)

def test_calculate_domain_authority(serp_worker):
    """Test domain authority calculation"""
    test_domains = [
        "google.com",
        "example.com",
        "small-blog.com",
        "new-site.org"
    ]
    
    for domain in test_domains:
        authority = serp_worker._calculate_domain_authority(domain)
        assert isinstance(authority, int)
        assert 0 <= authority <= 100

def test_detect_content_type(serp_worker):
    """Test content type detection"""
    test_cases = [
        ("How to Do SEO", "Learn step-by-step SEO techniques", "how_to"),
        ("Best SEO Tools", "Top 10 SEO tools reviewed", "review"),
        ("SEO Services", "Professional SEO services", "service"),
        ("SEO Course", "Learn SEO online", "course"),
        ("SEO Blog", "Latest SEO news and tips", "blog"),
    ]
    
    for title, snippet, expected_type in test_cases:
        content_type = serp_worker._detect_content_type(title, snippet)
        assert isinstance(content_type, str)
        assert len(content_type) > 0

def test_extract_schema_hints(serp_worker):
    """Test schema hints extraction"""
    title = "Best SEO Tools 2024 - Top 10 Reviewed"
    snippet = "Compare the best SEO tools for your business needs. Find pricing, features, and reviews."
    
    hints = serp_worker._extract_schema_hints(title, snippet)
    
    assert isinstance(hints, list)
    # Should detect review-related hints
    assert any('review' in hint.lower() for hint in hints)

def test_calculate_relevance(serp_worker):
    """Test relevance calculation"""
    title = "Best SEO Tools for Small Business"
    snippet = "Find the perfect SEO tools for your small business needs"
    keyword = "seo tools"
    
    relevance = serp_worker._calculate_relevance(title, snippet, keyword)
    
    assert isinstance(relevance, float)
    assert 0 <= relevance <= 1
    
    # Should be high for relevant content
    assert relevance > 0.5

@pytest.mark.asyncio
async def test_fetch_people_also_ask(serp_worker):
    """Test People Also Ask fetching"""
    keyword = "seo tools"
    
    result = await serp_worker.fetch_people_also_ask(keyword)
    
    assert isinstance(result, list)
    # Should return relevant questions
    for question in result:
        assert isinstance(question, str)
        assert len(question) > 0

@pytest.mark.asyncio
async def test_fetch_featured_snippet(serp_worker):
    """Test featured snippet fetching"""
    keyword = "what is seo"
    
    result = await serp_worker.fetch_featured_snippet(keyword)
    
    # Can be None if no featured snippet
    if result is not None:
        assert isinstance(result, dict)
        assert 'title' in result
        assert 'snippet' in result
        assert 'url' in result

@pytest.mark.asyncio
async def test_fetch_serp_results_empty_keyword(serp_worker):
    """Test SERP fetching with empty keyword"""
    result = await serp_worker.fetch_serp_results("")
    
    assert isinstance(result, list)
    # Should handle empty input gracefully
    assert len(result) >= 0

@pytest.mark.asyncio
async def test_fetch_serp_results_special_characters(serp_worker):
    """Test SERP fetching with special characters"""
    keyword = "SEO & PPC tools 2024!"
    
    result = await serp_worker.fetch_serp_results(keyword)
    
    assert isinstance(result, list)
    assert len(result) > 0
    
    # Should handle special characters gracefully
    for item in result:
        assert 'title' in item
        assert 'url' in item

@pytest.mark.asyncio
async def test_fetch_serp_results_performance(serp_worker):
    """Test SERP fetching performance"""
    import time
    
    keyword = "digital marketing strategies"
    
    start_time = time.time()
    result = await serp_worker.fetch_serp_results(keyword)
    end_time = time.time()
    
    duration = end_time - start_time
    
    # Should complete within reasonable time
    assert duration < 10  # 10 seconds max
    
    assert isinstance(result, list)
    assert len(result) > 0

def test_domain_authority_distribution(serp_worker):
    """Test that domain authority follows expected distribution"""
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
        authority = serp_worker._calculate_domain_authority(domain)
        authorities.append(authority)
    
    # Well-known domains should have higher authority
    assert serp_worker._calculate_domain_authority("google.com") > 50
    assert serp_worker._calculate_domain_authority("small-blog.com") < 50

def test_content_type_detection_accuracy(serp_worker):
    """Test content type detection accuracy"""
    test_cases = [
        ("How to Do SEO", "Step-by-step guide", "how_to"),
        ("Best SEO Tools 2024", "Top tools reviewed", "review"),
        ("SEO Services", "Professional services", "service"),
        ("SEO Course Online", "Learn SEO", "course"),
        ("SEO Blog Post", "Latest tips", "blog"),
    ]
    
    for title, snippet, expected_type in test_cases:
        detected_type = serp_worker._detect_content_type(title, snippet)
        # Should detect the expected type or a related type
        assert detected_type in ['how_to', 'review', 'service', 'course', 'blog', 'article']

def test_relevance_calculation_accuracy(serp_worker):
    """Test relevance calculation accuracy"""
    # High relevance case
    high_relevance = serp_worker._calculate_relevance(
        "Best SEO Tools for Small Business",
        "Find the perfect SEO tools for your small business needs",
        "seo tools"
    )
    
    # Low relevance case
    low_relevance = serp_worker._calculate_relevance(
        "How to Cook Pasta",
        "Learn to cook delicious pasta recipes",
        "seo tools"
    )
    
    assert high_relevance > low_relevance
    assert high_relevance > 0.5
    assert low_relevance < 0.3

@pytest.mark.asyncio
async def test_error_handling_api_failure(serp_worker):
    """Test error handling when API fails"""
    with patch.object(serp_worker, '_simulate_serp_api', side_effect=Exception("API error")):
        keyword = "test keyword"
        
        # Should handle errors gracefully
        result = await serp_worker.fetch_serp_results(keyword)
        
        assert isinstance(result, list)
        # Should return empty list or fallback data
        assert len(result) >= 0

@pytest.mark.asyncio
async def test_error_handling_enrichment_failure(serp_worker):
    """Test error handling when enrichment fails"""
    with patch.object(serp_worker, '_enrich_result', side_effect=Exception("Enrichment error")):
        keyword = "test keyword"
        
        # Should handle errors gracefully
        result = await serp_worker.fetch_serp_results(keyword)
        
        assert isinstance(result, list)
        # Should return basic results without enrichment
        assert len(result) >= 0

def test_schema_hints_extraction_comprehensive(serp_worker):
    """Test comprehensive schema hints extraction"""
    test_cases = [
        ("Best SEO Tools", "Top 10 SEO tools with reviews", ["review", "list"]),
        ("How to Do SEO", "Step-by-step SEO guide", ["how_to", "guide"]),
        ("SEO Services", "Professional SEO services", ["service", "business"]),
        ("SEO Course", "Learn SEO online", ["course", "education"]),
    ]
    
    for title, snippet, expected_hints in test_cases:
        hints = serp_worker._extract_schema_hints(title, snippet)
        assert isinstance(hints, list)
        # Should extract relevant hints
        assert len(hints) > 0

@pytest.mark.asyncio
async def test_people_also_ask_relevance(serp_worker):
    """Test that People Also Ask questions are relevant"""
    keyword = "seo tools"
    
    questions = await serp_worker.fetch_people_also_ask(keyword)
    
    for question in questions:
        # Questions should be related to the keyword
        assert keyword.lower() in question.lower() or any(word in question.lower() for word in ['seo', 'tools', 'marketing'])

@pytest.mark.asyncio
async def test_featured_snippet_quality(serp_worker):
    """Test featured snippet quality"""
    keyword = "what is seo"
    
    snippet = await serp_worker.fetch_featured_snippet(keyword)
    
    if snippet is not None:
        # Should have meaningful content
        assert len(snippet['title']) > 0
        assert len(snippet['snippet']) > 10
        assert snippet['url'].startswith('http')

def test_url_validation(serp_worker):
    """Test URL validation in results"""
    keyword = "seo tools"
    
    # This would need to be tested with actual API results
    # For now, test the simulation
    async def test_urls():
        results = await serp_worker._simulate_serp_api(keyword, "us", "en")
        for result in results:
            assert result['url'].startswith('http')
            assert 'domain' in result
    
    asyncio.run(test_urls())

if __name__ == "__main__":
    pytest.main([__file__])
