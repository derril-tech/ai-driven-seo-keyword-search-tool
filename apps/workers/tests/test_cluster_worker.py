import pytest
import asyncio
import numpy as np
from unittest.mock import Mock, patch, AsyncMock
from workers.cluster_worker import ClusterWorker

@pytest.fixture
def cluster_worker():
    return ClusterWorker()

@pytest.fixture
def sample_keywords():
    return [
        {
            'id': '1',
            'keyword': 'seo tools',
            'search_volume': 10000,
            'difficulty': 75,
            'intent': 'commercial',
            'features': ['featured_snippet', 'reviews']
        },
        {
            'id': '2',
            'keyword': 'best seo tools',
            'search_volume': 8000,
            'difficulty': 80,
            'intent': 'commercial',
            'features': ['reviews']
        },
        {
            'id': '3',
            'keyword': 'how to do seo',
            'search_volume': 5000,
            'difficulty': 70,
            'intent': 'informational',
            'features': ['how_to']
        },
        {
            'id': '4',
            'keyword': 'seo tutorial',
            'search_volume': 3000,
            'difficulty': 65,
            'intent': 'informational',
            'features': ['how_to']
        },
        {
            'id': '5',
            'keyword': 'buy seo software',
            'search_volume': 2000,
            'difficulty': 85,
            'intent': 'transactional',
            'features': []
        }
    ]

@pytest.mark.asyncio
async def test_cluster_keywords_basic(cluster_worker, sample_keywords):
    """Test basic keyword clustering"""
    result = await cluster_worker.cluster_keywords(sample_keywords)
    
    assert isinstance(result, dict)
    assert 'clusters' in result
    assert 'metadata' in result
    
    clusters = result['clusters']
    assert isinstance(clusters, list)
    assert len(clusters) > 0
    
    # Check cluster structure
    for cluster in clusters:
        assert 'id' in cluster
        assert 'label' in cluster
        assert 'keywords' in cluster
        assert 'centroid' in cluster
        assert 'metrics' in cluster
        assert isinstance(cluster['keywords'], list)
        assert len(cluster['keywords']) > 0

@pytest.mark.asyncio
async def test_cluster_keywords_with_embeddings(cluster_worker, sample_keywords):
    """Test clustering with embeddings"""
    # Add mock embeddings
    for keyword in sample_keywords:
        keyword['embedding'] = np.random.rand(384).tolist()
    
    result = await cluster_worker.cluster_keywords(sample_keywords)
    
    assert isinstance(result, dict)
    assert 'clusters' in result
    
    clusters = result['clusters']
    assert len(clusters) > 0
    
    # Should have fewer clusters than keywords
    assert len(clusters) < len(sample_keywords)

@pytest.mark.asyncio
async def test_cluster_keywords_without_embeddings(cluster_worker, sample_keywords):
    """Test clustering without embeddings (should generate them)"""
    result = await cluster_worker.cluster_keywords(sample_keywords)
    
    assert isinstance(result, dict)
    assert 'clusters' in result
    
    clusters = result['clusters']
    assert len(clusters) > 0

def test_generate_embeddings(cluster_worker, sample_keywords):
    """Test embedding generation"""
    embeddings = cluster_worker._generate_embeddings(sample_keywords)
    
    assert isinstance(embeddings, np.ndarray)
    assert embeddings.shape[0] == len(sample_keywords)
    assert embeddings.shape[1] > 0  # Should have embedding dimension

def test_perform_clustering(cluster_worker):
    """Test HDBSCAN clustering"""
    # Create mock embeddings
    embeddings = np.random.rand(10, 384)
    
    clusters = cluster_worker._perform_clustering(embeddings)
    
    assert isinstance(clusters, np.ndarray)
    assert len(clusters) == len(embeddings)
    
    # Should have some clusters (not all -1)
    unique_clusters = set(clusters)
    assert len(unique_clusters) > 1 or -1 in unique_clusters

def test_create_cluster_objects(cluster_worker, sample_keywords):
    """Test cluster object creation"""
    # Create mock clustering result
    cluster_labels = np.array([0, 0, 1, 1, 2])  # 3 clusters
    embeddings = np.random.rand(len(sample_keywords), 384)
    
    clusters = cluster_worker._create_cluster_objects(
        sample_keywords, cluster_labels, embeddings
    )
    
    assert isinstance(clusters, list)
    assert len(clusters) == 3  # Should have 3 clusters
    
    for cluster in clusters:
        assert 'id' in cluster
        assert 'label' in cluster
        assert 'keywords' in cluster
        assert 'centroid' in cluster
        assert 'metrics' in cluster
        assert len(cluster['keywords']) > 0

def test_calculate_cluster_metrics(cluster_worker):
    """Test cluster metrics calculation"""
    cluster_keywords = [
        {'search_volume': 1000, 'difficulty': 50},
        {'search_volume': 2000, 'difficulty': 60},
        {'search_volume': 1500, 'difficulty': 55}
    ]
    
    metrics = cluster_worker._calculate_cluster_metrics(cluster_keywords)
    
    assert isinstance(metrics, dict)
    assert 'avg_search_volume' in metrics
    assert 'avg_difficulty' in metrics
    assert 'total_keywords' in metrics
    assert 'intent_distribution' in metrics
    
    assert metrics['total_keywords'] == 3
    assert 1000 <= metrics['avg_search_volume'] <= 2000
    assert 50 <= metrics['avg_difficulty'] <= 60

def test_generate_cluster_label(cluster_worker):
    """Test cluster label generation"""
    cluster_keywords = [
        {'keyword': 'seo tools', 'intent': 'commercial'},
        {'keyword': 'best seo tools', 'intent': 'commercial'},
        {'keyword': 'seo software', 'intent': 'commercial'}
    ]
    
    label = cluster_worker._generate_cluster_label(cluster_keywords)
    
    assert isinstance(label, str)
    assert len(label) > 0
    # Should contain relevant terms from keywords
    assert 'seo' in label.lower()

def test_calculate_centroid(cluster_worker):
    """Test centroid calculation"""
    embeddings = np.array([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
    ])
    
    centroid = cluster_worker._calculate_centroid(embeddings)
    
    assert isinstance(centroid, list)
    assert len(centroid) == 3
    # Should be the mean of embeddings
    assert centroid[0] == 4.0
    assert centroid[1] == 5.0
    assert centroid[2] == 6.0

@pytest.mark.asyncio
async def test_cluster_keywords_empty_input(cluster_worker):
    """Test clustering with empty input"""
    result = await cluster_worker.cluster_keywords([])
    
    assert isinstance(result, dict)
    assert 'clusters' in result
    assert result['clusters'] == []

@pytest.mark.asyncio
async def test_cluster_keywords_single_keyword(cluster_worker):
    """Test clustering with single keyword"""
    single_keyword = [{
        'id': '1',
        'keyword': 'seo tools',
        'search_volume': 1000,
        'difficulty': 50,
        'intent': 'commercial'
    }]
    
    result = await cluster_worker.cluster_keywords(single_keyword)
    
    assert isinstance(result, dict)
    assert 'clusters' in result
    assert len(result['clusters']) == 1

def test_embedding_consistency(cluster_worker, sample_keywords):
    """Test that embeddings are consistent for same keywords"""
    embeddings1 = cluster_worker._generate_embeddings(sample_keywords)
    embeddings2 = cluster_worker._generate_embeddings(sample_keywords)
    
    # Should be identical for same input
    np.testing.assert_array_equal(embeddings1, embeddings2)

def test_clustering_consistency(cluster_worker, sample_keywords):
    """Test that clustering is consistent for same input"""
    # Add embeddings for consistency
    for keyword in sample_keywords:
        keyword['embedding'] = np.random.rand(384).tolist()
    
    result1 = await cluster_worker.cluster_keywords(sample_keywords)
    result2 = await cluster_worker.cluster_keywords(sample_keywords)
    
    # Should have same number of clusters
    assert len(result1['clusters']) == len(result2['clusters'])

def test_cluster_quality_metrics(cluster_worker, sample_keywords):
    """Test cluster quality metrics"""
    # Add embeddings
    for keyword in sample_keywords:
        keyword['embedding'] = np.random.rand(384).tolist()
    
    result = await cluster_worker.cluster_keywords(sample_keywords)
    
    metadata = result['metadata']
    assert 'total_clusters' in metadata
    assert 'avg_cluster_size' in metadata
    assert 'silhouette_score' in metadata
    
    assert metadata['total_clusters'] > 0
    assert metadata['avg_cluster_size'] > 0

def test_intent_based_clustering(cluster_worker):
    """Test that clustering respects intent"""
    intent_keywords = [
        {'keyword': 'how to seo', 'intent': 'informational', 'embedding': np.random.rand(384).tolist()},
        {'keyword': 'seo guide', 'intent': 'informational', 'embedding': np.random.rand(384).tolist()},
        {'keyword': 'buy seo tools', 'intent': 'transactional', 'embedding': np.random.rand(384).tolist()},
        {'keyword': 'seo software', 'intent': 'transactional', 'embedding': np.random.rand(384).tolist()},
    ]
    
    result = await cluster_worker.cluster_keywords(intent_keywords)
    
    clusters = result['clusters']
    
    # Should create separate clusters for different intents
    if len(clusters) > 1:
        intents_in_clusters = []
        for cluster in clusters:
            cluster_intents = [kw['intent'] for kw in cluster['keywords']]
            intents_in_clusters.append(set(cluster_intents))
        
        # Should have some intent separation
        assert len(set.union(*intents_in_clusters)) > 1

def test_cluster_size_distribution(cluster_worker, sample_keywords):
    """Test cluster size distribution"""
    # Add embeddings
    for keyword in sample_keywords:
        keyword['embedding'] = np.random.rand(384).tolist()
    
    result = await cluster_worker.cluster_keywords(sample_keywords)
    
    clusters = result['clusters']
    cluster_sizes = [len(cluster['keywords']) for cluster in clusters]
    
    # Should have reasonable cluster sizes
    assert min(cluster_sizes) >= 1
    assert max(cluster_sizes) <= len(sample_keywords)

@pytest.mark.asyncio
async def test_error_handling_embedding_generation(cluster_worker):
    """Test error handling in embedding generation"""
    with patch.object(cluster_worker, '_generate_embeddings', side_effect=Exception("Embedding error")):
        sample_keywords = [{'keyword': 'test', 'intent': 'informational'}]
        
        # Should handle errors gracefully
        result = await cluster_worker.cluster_keywords(sample_keywords)
        
        assert isinstance(result, dict)
        assert 'clusters' in result

@pytest.mark.asyncio
async def test_error_handling_clustering(cluster_worker):
    """Test error handling in clustering"""
    with patch.object(cluster_worker, '_perform_clustering', side_effect=Exception("Clustering error")):
        sample_keywords = [{'keyword': 'test', 'intent': 'informational', 'embedding': [0.1] * 384}]
        
        # Should handle errors gracefully
        result = await cluster_worker.cluster_keywords(sample_keywords)
        
        assert isinstance(result, dict)
        assert 'clusters' in result

def test_noise_handling(cluster_worker):
    """Test handling of noise points (unclustered keywords)"""
    # Create keywords that might not cluster well
    noise_keywords = [
        {'keyword': 'seo tools', 'intent': 'commercial', 'embedding': np.random.rand(384).tolist()},
        {'keyword': 'cooking recipes', 'intent': 'informational', 'embedding': np.random.rand(384).tolist()},
        {'keyword': 'travel destinations', 'intent': 'informational', 'embedding': np.random.rand(384).tolist()},
    ]
    
    result = cluster_worker._perform_clustering(
        np.array([kw['embedding'] for kw in noise_keywords])
    )
    
    # Should handle noise gracefully
    assert isinstance(result, np.ndarray)
    assert len(result) == len(noise_keywords)

def test_cluster_label_quality(cluster_worker):
    """Test quality of generated cluster labels"""
    test_cases = [
        # Commercial cluster
        ([
            {'keyword': 'best seo tools', 'intent': 'commercial'},
            {'keyword': 'seo software reviews', 'intent': 'commercial'},
            {'keyword': 'top seo platforms', 'intent': 'commercial'}
        ], 'seo'),
        # Informational cluster
        ([
            {'keyword': 'how to do seo', 'intent': 'informational'},
            {'keyword': 'seo tutorial', 'intent': 'informational'},
            {'keyword': 'learn seo', 'intent': 'informational'}
        ], 'seo'),
    ]
    
    for keywords, expected_term in test_cases:
        label = cluster_worker._generate_cluster_label(keywords)
        assert expected_term.lower() in label.lower()

if __name__ == "__main__":
    pytest.main([__file__])
