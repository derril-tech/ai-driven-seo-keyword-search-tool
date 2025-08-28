import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from workers.expand_worker import ExpandWorker
from workers.serp_worker import SerpWorker
from workers.intent_worker import IntentWorker
from workers.difficulty_worker import DifficultyWorker
from workers.cluster_worker import ClusterWorker
from workers.serp_feature_parser import SerpFeatureParser

@pytest.fixture
def expand_worker():
    return ExpandWorker()

@pytest.fixture
def serp_worker():
    return SerpWorker(api_key="test_key", provider="serpapi")

@pytest.fixture
def intent_worker():
    return IntentWorker()

@pytest.fixture
def difficulty_worker():
    return DifficultyWorker()

@pytest.fixture
def cluster_worker():
    return ClusterWorker()

@pytest.fixture
def serp_parser():
    return SerpFeatureParser()

@pytest.mark.asyncio
async def test_complete_workflow_seed_to_keywords(expand_worker, serp_worker, intent_worker, 
                                                 difficulty_worker, cluster_worker, serp_parser):
    """Test complete workflow from seed to expanded keywords"""
    # Step 1: Expand seed keyword
    seed_keyword = "digital marketing"
    project_id = "test-project-123"
    
    expanded_keywords = await expand_worker.expand_keywords(seed_keyword, project_id)
    
    assert isinstance(expanded_keywords, list)
    assert len(expanded_keywords) > 0
    
    # Step 2: Fetch SERP results for each keyword
    enriched_keywords = []
    for keyword_data in expanded_keywords[:3]:  # Limit to 3 for testing
        keyword = keyword_data['keyword']
        
        # Fetch SERP results
        serp_results = await serp_worker.fetch_serp_results(keyword)
        
        # Classify intent
        intent_result = await intent_worker.classify_intent(keyword, serp_results)
        
        # Calculate difficulty
        difficulty_result = await difficulty_worker.calculate_difficulty(keyword, serp_results)
        
        # Parse SERP features
        serp_features = await serp_parser.parse_serp_features(serp_results)
        
        # Combine all data
        enriched_keyword = {
            **keyword_data,
            'serp_results': serp_results,
            'intent': intent_result['intent'],
            'intent_confidence': intent_result['confidence'],
            'difficulty_score': difficulty_result['difficulty_score'],
            'competition_level': difficulty_result['competition_level'],
            'serp_features': serp_features
        }
        
        enriched_keywords.append(enriched_keyword)
    
    assert len(enriched_keywords) > 0
    
    # Step 3: Cluster keywords
    clusters = await cluster_worker.cluster_keywords(enriched_keywords)
    
    assert isinstance(clusters, dict)
    assert 'clusters' in clusters
    assert 'metadata' in clusters
    
    # Verify cluster structure
    for cluster in clusters['clusters']:
        assert 'id' in cluster
        assert 'label' in cluster
        assert 'keywords' in cluster
        assert 'metrics' in cluster
        assert len(cluster['keywords']) > 0

@pytest.mark.asyncio
async def test_workflow_data_consistency(expand_worker, serp_worker, intent_worker, 
                                        difficulty_worker, cluster_worker):
    """Test that data flows consistently through the workflow"""
    seed_keyword = "seo tools"
    project_id = "test-project-456"
    
    # Expand keywords
    expanded_keywords = await expand_worker.expand_keywords(seed_keyword, project_id)
    
    # Process first keyword through full pipeline
    if expanded_keywords:
        keyword_data = expanded_keywords[0]
        keyword = keyword_data['keyword']
        
        # Verify keyword structure
        assert 'project_id' in keyword_data
        assert 'keyword' in keyword_data
        assert 'source' in keyword_data
        assert 'confidence' in keyword_data
        assert keyword_data['project_id'] == project_id
        
        # Fetch SERP results
        serp_results = await serp_worker.fetch_serp_results(keyword)
        
        # Verify SERP results structure
        for result in serp_results:
            assert 'title' in result
            assert 'url' in result
            assert 'snippet' in result
            assert 'domain' in result
            assert 'position' in result
        
        # Classify intent
        intent_result = await intent_worker.classify_intent(keyword, serp_results)
        
        # Verify intent result structure
        assert 'intent' in intent_result
        assert 'confidence' in intent_result
        assert 'scores' in intent_result
        assert intent_result['intent'] in ['informational', 'commercial', 'transactional', 'navigational', 'local']
        
        # Calculate difficulty
        difficulty_result = await difficulty_worker.calculate_difficulty(keyword, serp_results)
        
        # Verify difficulty result structure
        assert 'difficulty_score' in difficulty_result
        assert 'factors' in difficulty_result
        assert 'competition_level' in difficulty_result
        assert 'recommendations' in difficulty_result
        assert 0 <= difficulty_result['difficulty_score'] <= 100

@pytest.mark.asyncio
async def test_workflow_error_handling(expand_worker, serp_worker, intent_worker, 
                                     difficulty_worker, cluster_worker):
    """Test error handling throughout the workflow"""
    # Test with problematic input
    seed_keyword = ""  # Empty keyword
    project_id = "test-project-error"
    
    # Should handle empty keyword gracefully
    expanded_keywords = await expand_worker.expand_keywords(seed_keyword, project_id)
    assert isinstance(expanded_keywords, list)
    
    # Test with special characters
    special_keyword = "SEO & PPC tools 2024!"
    expanded_special = await expand_worker.expand_keywords(special_keyword, project_id)
    assert isinstance(expanded_special, list)
    
    # Test SERP worker with empty keyword
    empty_serp = await serp_worker.fetch_serp_results("")
    assert isinstance(empty_serp, list)
    
    # Test intent worker with empty keyword
    empty_intent = await intent_worker.classify_intent("")
    assert isinstance(empty_intent, dict)
    assert 'intent' in empty_intent
    
    # Test difficulty worker with empty SERP results
    empty_difficulty = await difficulty_worker.calculate_difficulty("test", [])
    assert isinstance(empty_difficulty, dict)
    assert 'difficulty_score' in empty_difficulty
    
    # Test cluster worker with empty keywords
    empty_clusters = await cluster_worker.cluster_keywords([])
    assert isinstance(empty_clusters, dict)
    assert 'clusters' in empty_clusters

@pytest.mark.asyncio
async def test_workflow_performance(expand_worker, serp_worker, intent_worker, 
                                   difficulty_worker, cluster_worker):
    """Test workflow performance with reasonable timeouts"""
    import time
    
    seed_keyword = "content marketing"
    project_id = "test-project-performance"
    
    start_time = time.time()
    
    # Complete workflow
    expanded_keywords = await expand_worker.expand_keywords(seed_keyword, project_id)
    
    # Process a subset for performance testing
    test_keywords = expanded_keywords[:2]
    
    for keyword_data in test_keywords:
        keyword = keyword_data['keyword']
        
        # Fetch SERP results
        serp_results = await serp_worker.fetch_serp_results(keyword)
        
        # Classify intent
        await intent_worker.classify_intent(keyword, serp_results)
        
        # Calculate difficulty
        await difficulty_worker.calculate_difficulty(keyword, serp_results)
    
    # Cluster keywords
    await cluster_worker.cluster_keywords(test_keywords)
    
    end_time = time.time()
    duration = end_time - start_time
    
    # Should complete within reasonable time (adjust as needed)
    assert duration < 60  # 60 seconds max for complete workflow

@pytest.mark.asyncio
async def test_workflow_data_quality(expand_worker, serp_worker, intent_worker, 
                                    difficulty_worker, cluster_worker):
    """Test data quality throughout the workflow"""
    seed_keyword = "email marketing"
    project_id = "test-project-quality"
    
    # Expand keywords
    expanded_keywords = await expand_worker.expand_keywords(seed_keyword, project_id)
    
    # Verify expansion quality
    assert len(expanded_keywords) > 0
    
    # Check that expanded keywords are relevant
    relevant_keywords = [kw for kw in expanded_keywords if 'email' in kw['keyword'].lower() or 'marketing' in kw['keyword'].lower()]
    assert len(relevant_keywords) > 0
    
    # Process through pipeline
    for keyword_data in expanded_keywords[:2]:
        keyword = keyword_data['keyword']
        
        # SERP results quality
        serp_results = await serp_worker.fetch_serp_results(keyword)
        assert len(serp_results) > 0
        
        # Intent classification quality
        intent_result = await intent_worker.classify_intent(keyword, serp_results)
        assert intent_result['confidence'] > 0
        
        # Difficulty calculation quality
        difficulty_result = await difficulty_worker.calculate_difficulty(keyword, serp_results)
        assert 0 <= difficulty_result['difficulty_score'] <= 100
        assert len(difficulty_result['recommendations']) > 0

@pytest.mark.asyncio
async def test_workflow_batch_processing(expand_worker, serp_worker, intent_worker, 
                                        difficulty_worker, cluster_worker):
    """Test batch processing capabilities"""
    seed_keywords = ["seo", "ppc", "content marketing"]
    project_id = "test-project-batch"
    
    all_expanded = []
    
    # Expand multiple seeds
    for seed in seed_keywords:
        expanded = await expand_worker.expand_keywords(seed, project_id)
        all_expanded.extend(expanded)
    
    assert len(all_expanded) > 0
    
    # Test batch intent classification
    keywords_list = [kw['keyword'] for kw in all_expanded[:5]]
    batch_intents = await intent_worker.classify_batch(keywords_list)
    
    assert len(batch_intents) == len(keywords_list)
    for intent_result in batch_intents:
        assert 'keyword' in intent_result
        assert 'intent' in intent_result
        assert 'confidence' in intent_result
    
    # Test batch difficulty calculation
    difficulty_data = [
        {'keyword': kw['keyword'], 'serp_results': []} 
        for kw in all_expanded[:3]
    ]
    batch_difficulties = await difficulty_worker.calculate_difficulty_batch(difficulty_data)
    
    assert len(batch_difficulties) == len(difficulty_data)
    for difficulty_result in batch_difficulties:
        assert 'keyword' in difficulty_result
        assert 'difficulty_score' in difficulty_result

@pytest.mark.asyncio
async def test_workflow_memory_efficiency(expand_worker, serp_worker, intent_worker, 
                                         difficulty_worker, cluster_worker):
    """Test memory efficiency of the workflow"""
    import gc
    import psutil
    import os
    
    process = psutil.Process(os.getpid())
    initial_memory = process.memory_info().rss
    
    seed_keyword = "digital marketing strategies"
    project_id = "test-project-memory"
    
    # Run workflow
    expanded_keywords = await expand_worker.expand_keywords(seed_keyword, project_id)
    
    # Process keywords
    for keyword_data in expanded_keywords[:3]:
        keyword = keyword_data['keyword']
        serp_results = await serp_worker.fetch_serp_results(keyword)
        await intent_worker.classify_intent(keyword, serp_results)
        await difficulty_worker.calculate_difficulty(keyword, serp_results)
    
    # Cluster keywords
    await cluster_worker.cluster_keywords(expanded_keywords[:5])
    
    # Force garbage collection
    gc.collect()
    
    final_memory = process.memory_info().rss
    memory_increase = final_memory - initial_memory
    
    # Memory increase should be reasonable (less than 100MB)
    assert memory_increase < 100 * 1024 * 1024  # 100MB

if __name__ == "__main__":
    pytest.main([__file__])
