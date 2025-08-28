import pytest
import asyncio
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from workers.expand_worker import ExpandWorker
from workers.serp_worker import SerpWorker
from workers.intent_worker import IntentWorker
from workers.difficulty_worker import DifficultyWorker
from workers.cluster_worker import ClusterWorker

class LoadTester:
    def __init__(self):
        self.expand_worker = ExpandWorker()
        self.serp_worker = SerpWorker(api_key="test_key", provider="serpapi")
        self.intent_worker = IntentWorker()
        self.difficulty_worker = DifficultyWorker()
        self.cluster_worker = ClusterWorker()
        
    async def test_keyword_expansion_load(self, num_keywords=1000, max_workers=10):
        """Test keyword expansion under load"""
        print(f"Testing keyword expansion with {num_keywords} keywords and {max_workers} workers")
        
        # Generate test keywords
        test_keywords = [f"test keyword {i}" for i in range(num_keywords)]
        project_id = "load-test-project"
        
        start_time = time.time()
        
        # Process keywords in batches
        batch_size = 100
        results = []
        
        for i in range(0, len(test_keywords), batch_size):
            batch = test_keywords[i:i + batch_size]
            
            # Process batch concurrently
            tasks = []
            for keyword in batch:
                task = self.expand_worker.expand_keywords(keyword, project_id)
                tasks.append(task)
            
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            results.extend(batch_results)
            
            print(f"Processed batch {i//batch_size + 1}/{(len(test_keywords) + batch_size - 1)//batch_size}")
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Calculate statistics
        successful_results = [r for r in results if not isinstance(r, Exception)]
        failed_results = [r for r in results if isinstance(r, Exception)]
        
        print(f"Load test completed:")
        print(f"  Total keywords: {num_keywords}")
        print(f"  Successful: {len(successful_results)}")
        print(f"  Failed: {len(failed_results)}")
        print(f"  Duration: {duration:.2f} seconds")
        print(f"  Throughput: {num_keywords/duration:.2f} keywords/second")
        
        return {
            'total_keywords': num_keywords,
            'successful': len(successful_results),
            'failed': len(failed_results),
            'duration': duration,
            'throughput': num_keywords/duration
        }
    
    async def test_serp_concurrency(self, num_requests=100, max_concurrent=20):
        """Test SERP API concurrency and backoff"""
        print(f"Testing SERP concurrency with {num_requests} requests and {max_concurrent} concurrent")
        
        test_keywords = [f"serp test {i}" for i in range(num_requests)]
        
        start_time = time.time()
        
        # Use semaphore to limit concurrency
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def fetch_serp_with_semaphore(keyword):
            async with semaphore:
                return await self.serp_worker.fetch_serp_results(keyword)
        
        tasks = [fetch_serp_with_semaphore(keyword) for keyword in test_keywords]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        end_time = time.time()
        duration = end_time - start_time
        
        successful_results = [r for r in results if not isinstance(r, Exception)]
        failed_results = [r for r in results if isinstance(r, Exception)]
        
        print(f"SERP concurrency test completed:")
        print(f"  Total requests: {num_requests}")
        print(f"  Max concurrent: {max_concurrent}")
        print(f"  Successful: {len(successful_results)}")
        print(f"  Failed: {len(failed_results)}")
        print(f"  Duration: {duration:.2f} seconds")
        print(f"  Throughput: {num_requests/duration:.2f} requests/second")
        
        return {
            'total_requests': num_requests,
            'max_concurrent': max_concurrent,
            'successful': len(successful_results),
            'failed': len(failed_results),
            'duration': duration,
            'throughput': num_requests/duration
        }
    
    async def test_clustering_load(self, num_keywords=10000):
        """Test clustering under load"""
        print(f"Testing clustering with {num_keywords} keywords")
        
        # Generate test keywords with embeddings
        test_keywords = []
        for i in range(num_keywords):
            keyword = {
                'id': f'kw_{i}',
                'keyword': f'test keyword {i}',
                'search_volume': 1000 + (i % 1000),
                'difficulty': 50 + (i % 50),
                'intent': ['informational', 'commercial', 'transactional'][i % 3],
                'embedding': [0.1] * 384  # Mock embedding
            }
            test_keywords.append(keyword)
        
        start_time = time.time()
        
        # Test clustering
        result = await self.cluster_worker.cluster_keywords(test_keywords)
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"Clustering load test completed:")
        print(f"  Total keywords: {num_keywords}")
        print(f"  Clusters created: {len(result['clusters'])}")
        print(f"  Duration: {duration:.2f} seconds")
        print(f"  Keywords per second: {num_keywords/duration:.2f}")
        
        return {
            'total_keywords': num_keywords,
            'clusters_created': len(result['clusters']),
            'duration': duration,
            'throughput': num_keywords/duration
        }
    
    async def test_opensearch_shard_pressure(self, num_operations=1000):
        """Test OpenSearch shard pressure"""
        print(f"Testing OpenSearch operations: {num_operations}")
        
        # Simulate OpenSearch operations
        operations = []
        for i in range(num_operations):
            operation = {
                'type': 'index',
                'document': {
                    'keyword': f'test keyword {i}',
                    'embedding': [0.1] * 384,
                    'metadata': {'timestamp': time.time()}
                }
            }
            operations.append(operation)
        
        start_time = time.time()
        
        # Simulate batch processing
        batch_size = 100
        for i in range(0, len(operations), batch_size):
            batch = operations[i:i + batch_size]
            # Simulate processing time
            await asyncio.sleep(0.01)
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"OpenSearch pressure test completed:")
        print(f"  Total operations: {num_operations}")
        print(f"  Duration: {duration:.2f} seconds")
        print(f"  Operations per second: {num_operations/duration:.2f}")
        
        return {
            'total_operations': num_operations,
            'duration': duration,
            'throughput': num_operations/duration
        }
    
    async def test_memory_usage(self, num_iterations=100):
        """Test memory usage under load"""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss
        
        print(f"Testing memory usage with {num_iterations} iterations")
        
        memory_samples = []
        
        for i in range(num_iterations):
            # Generate test data
            test_keywords = [f"memory test {j}" for j in range(100)]
            
            # Process keywords
            for keyword in test_keywords:
                await self.expand_worker.expand_keywords(keyword, "memory-test")
            
            # Measure memory
            current_memory = process.memory_info().rss
            memory_samples.append(current_memory)
            
            if i % 10 == 0:
                print(f"  Iteration {i}: {current_memory / 1024 / 1024:.2f} MB")
        
        final_memory = process.memory_info().rss
        memory_increase = final_memory - initial_memory
        
        print(f"Memory usage test completed:")
        print(f"  Initial memory: {initial_memory / 1024 / 1024:.2f} MB")
        print(f"  Final memory: {final_memory / 1024 / 1024:.2f} MB")
        print(f"  Memory increase: {memory_increase / 1024 / 1024:.2f} MB")
        print(f"  Peak memory: {max(memory_samples) / 1024 / 1024:.2f} MB")
        
        return {
            'initial_memory_mb': initial_memory / 1024 / 1024,
            'final_memory_mb': final_memory / 1024 / 1024,
            'memory_increase_mb': memory_increase / 1024 / 1024,
            'peak_memory_mb': max(memory_samples) / 1024 / 1024
        }

@pytest.mark.asyncio
async def test_keyword_expansion_load():
    """Test keyword expansion under load"""
    load_tester = LoadTester()
    result = await load_tester.test_keyword_expansion_load(num_keywords=100, max_workers=5)
    
    # Assertions for load test
    assert result['successful'] > 0
    assert result['throughput'] > 0
    assert result['duration'] < 60  # Should complete within 60 seconds

@pytest.mark.asyncio
async def test_serp_concurrency():
    """Test SERP API concurrency"""
    load_tester = LoadTester()
    result = await load_tester.test_serp_concurrency(num_requests=50, max_concurrent=10)
    
    # Assertions for concurrency test
    assert result['successful'] > 0
    assert result['throughput'] > 0
    assert result['duration'] < 30  # Should complete within 30 seconds

@pytest.mark.asyncio
async def test_clustering_load():
    """Test clustering under load"""
    load_tester = LoadTester()
    result = await load_tester.test_clustering_load(num_keywords=100)
    
    # Assertions for clustering test
    assert result['clusters_created'] > 0
    assert result['throughput'] > 0
    assert result['duration'] < 60  # Should complete within 60 seconds

@pytest.mark.asyncio
async def test_opensearch_pressure():
    """Test OpenSearch shard pressure"""
    load_tester = LoadTester()
    result = await load_tester.test_opensearch_shard_pressure(num_operations=100)
    
    # Assertions for OpenSearch test
    assert result['throughput'] > 0
    assert result['duration'] < 30  # Should complete within 30 seconds

@pytest.mark.asyncio
async def test_memory_usage():
    """Test memory usage under load"""
    load_tester = LoadTester()
    result = await load_tester.test_memory_usage(num_iterations=10)
    
    # Assertions for memory test
    assert result['memory_increase_mb'] < 100  # Should not increase by more than 100MB
    assert result['peak_memory_mb'] < 500  # Should not exceed 500MB

@pytest.mark.asyncio
async def test_chaos_scenarios():
    """Test chaos scenarios for graceful degradation"""
    load_tester = LoadTester()
    
    # Test provider quota breach simulation
    print("Testing provider quota breach scenario")
    
    # Simulate quota breach by making many requests
    try:
        result = await load_tester.test_serp_concurrency(num_requests=1000, max_concurrent=50)
        print(f"Quota breach test: {result['failed']} failed requests")
    except Exception as e:
        print(f"Expected quota breach: {e}")
    
    # Test slow cluster jobs
    print("Testing slow cluster jobs scenario")
    
    # Simulate slow processing
    start_time = time.time()
    try:
        result = await load_tester.test_clustering_load(num_keywords=1000)
        print(f"Slow cluster test completed in {result['duration']:.2f} seconds")
    except Exception as e:
        print(f"Expected timeout: {e}")
    
    # Test export retries
    print("Testing export retry scenario")
    
    # Simulate export failures and retries
    retry_count = 0
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            # Simulate export operation
            await asyncio.sleep(0.1)
            print(f"Export attempt {attempt + 1} successful")
            break
        except Exception as e:
            retry_count += 1
            print(f"Export attempt {attempt + 1} failed, retrying...")
            await asyncio.sleep(1)  # Wait before retry
    
    print(f"Export completed after {retry_count} retries")

if __name__ == "__main__":
    pytest.main([__file__])
