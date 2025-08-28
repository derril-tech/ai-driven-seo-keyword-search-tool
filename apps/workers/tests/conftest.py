import pytest
import asyncio
import sys
import os
from pathlib import Path

# Add the src directory to the Python path
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# Mock dependencies for testing
@pytest.fixture(autouse=True)
def mock_dependencies():
    """Mock external dependencies for testing"""
    import sys
    from unittest.mock import MagicMock
    
    # Mock sentence_transformers
    mock_sentence_transformers = MagicMock()
    mock_model = MagicMock()
    mock_model.encode.return_value = [[0.1] * 384]  # Mock embeddings
    mock_sentence_transformers.SentenceTransformer.return_value = mock_model
    sys.modules['sentence_transformers'] = mock_sentence_transformers
    
    # Mock keybert
    mock_keybert = MagicMock()
    mock_keybert_model = MagicMock()
    mock_keybert_model.extract_keywords.return_value = [('test', 0.8)]
    mock_keybert.KeyBERT.return_value = mock_keybert_model
    sys.modules['keybert'] = mock_keybert
    
    # Mock yake
    mock_yake = MagicMock()
    mock_extractor = MagicMock()
    mock_extractor.extract_keywords.return_value = [('test', 0.7)]
    mock_yake.KeywordExtractor.return_value = mock_extractor
    sys.modules['yake'] = mock_yake
    
    # Mock hdbscan
    mock_hdbscan = MagicMock()
    mock_clusterer = MagicMock()
    mock_clusterer.fit_predict.return_value = [0, 0, 1, 1, 2]  # Mock cluster labels
    mock_hdbscan.HDBSCAN.return_value = mock_clusterer
    sys.modules['hdbscan'] = mock_hdbscan
    
    # Mock sklearn
    mock_sklearn = MagicMock()
    mock_silhouette_score = MagicMock()
    mock_silhouette_score.return_value = 0.5
    mock_sklearn.metrics.silhouette_score = mock_silhouette_score
    sys.modules['sklearn'] = mock_sklearn
    
    # Mock numpy
    mock_numpy = MagicMock()
    mock_numpy.array = lambda x: x
    mock_numpy.mean = lambda x: sum(x) / len(x) if x else 0
    mock_numpy.ndarray = list
    mock_numpy.testing.assert_array_equal = lambda x, y: x == y
    sys.modules['numpy'] = mock_numpy

@pytest.fixture
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def sample_keywords():
    """Sample keywords for testing"""
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
        }
    ]

@pytest.fixture
def sample_serp_results():
    """Sample SERP results for testing"""
    return [
        {
            'title': 'Best SEO Tools 2024 - Top 10 Reviewed',
            'snippet': 'Compare the best SEO tools for your business needs. Find pricing, features, and reviews.',
            'url': 'https://example.com/seo-tools',
            'position': 1,
            'features': ['featured_snippet', 'reviews'],
            'domain': 'example.com',
            'domain_authority': 85,
            'relevance': 0.9
        },
        {
            'title': 'How to Do SEO: Complete Guide for Beginners',
            'snippet': 'Learn step-by-step SEO techniques to improve your website ranking.',
            'url': 'https://guide.com/seo-guide',
            'position': 2,
            'features': ['how_to'],
            'domain': 'guide.com',
            'domain_authority': 75,
            'relevance': 0.8
        }
    ]
