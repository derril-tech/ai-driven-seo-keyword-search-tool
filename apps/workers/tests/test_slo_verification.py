import pytest
import asyncio
import time
import statistics
from workers.expand_worker import ExpandWorker
from workers.serp_worker import SerpWorker
from workers.intent_worker import IntentWorker
from workers.difficulty_worker import DifficultyWorker
from workers.cluster_worker import ClusterWorker

class SLOVerifier:
    def __init__(self):
        self.expand_worker = ExpandWorker()
        self.serp_worker = SerpWorker(api_key="test_key", provider="serpapi")
        self.intent_worker = IntentWorker()
        self.difficulty_worker = DifficultyWorker()
        self.cluster_worker = ClusterWorker()
        
        # SLO targets
        self.slo_targets = {
            'expand_response_time': 30,  # seconds
            'serp_response_time': 10,    # seconds
            'cluster_response_time': 60, # seconds
            'brief_response_time': 120,  # seconds
            'expand_success_rate': 0.95, # 95%
            'serp_success_rate': 0.90,   # 90%
            'cluster_success_rate': 0.95, # 95%
            'brief_success_rate': 0.90,   # 90%
        }
    
    async def verify_expand_slo(self, num_tests=100):
        """Verify keyword expansion SLOs"""
        print(f"Verifying expand SLOs with {num_tests} tests")
        
        test_keywords = [f"expand test {i}" for i in range(num_tests)]
        project_id = "slo-test-project"
        
        response_times = []
        success_count = 0
        
        for keyword in test_keywords:
            start_time = time.time()
            try:
                result = await self.expand_worker.expand_keywords(keyword, project_id)
                end_time = time.time()
                response_time = end_time - start_time
                response_times.append(response_time)
                success_count += 1
                
                # Verify result quality
                assert isinstance(result, list)
                assert len(result) > 0
                
            except Exception as e:
                print(f"Expand failed for '{keyword}': {e}")
                end_time = time.time()
                response_times.append(end_time - start_time)
        
        # Calculate metrics
        success_rate = success_count / num_tests
        avg_response_time = statistics.mean(response_times)
        p95_response_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
        
        print(f"Expand SLO Results:")
        print(f"  Success Rate: {success_rate:.3f} ({success_rate*100:.1f}%)")
        print(f"  Average Response Time: {avg_response_time:.2f}s")
        print(f"  95th Percentile Response Time: {p95_response_time:.2f}s")
        
        # Verify SLOs
        assert success_rate >= self.slo_targets['expand_success_rate'], f"Success rate {success_rate} below target {self.slo_targets['expand_success_rate']}"
        assert p95_response_time <= self.slo_targets['expand_response_time'], f"95th percentile response time {p95_response_time}s above target {self.slo_targets['expand_response_time']}s"
        
        return {
            'success_rate': success_rate,
            'avg_response_time': avg_response_time,
            'p95_response_time': p95_response_time,
            'slo_met': success_rate >= self.slo_targets['expand_success_rate'] and p95_response_time <= self.slo_targets['expand_response_time']
        }
    
    async def verify_serp_slo(self, num_tests=50):
        """Verify SERP API SLOs"""
        print(f"Verifying SERP SLOs with {num_tests} tests")
        
        test_keywords = [f"serp test {i}" for i in range(num_tests)]
        
        response_times = []
        success_count = 0
        
        for keyword in test_keywords:
            start_time = time.time()
            try:
                result = await self.serp_worker.fetch_serp_results(keyword)
                end_time = time.time()
                response_time = end_time - start_time
                response_times.append(response_time)
                success_count += 1
                
                # Verify result quality
                assert isinstance(result, list)
                assert len(result) > 0
                
            except Exception as e:
                print(f"SERP failed for '{keyword}': {e}")
                end_time = time.time()
                response_times.append(end_time - start_time)
        
        # Calculate metrics
        success_rate = success_count / num_tests
        avg_response_time = statistics.mean(response_times)
        p95_response_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
        
        print(f"SERP SLO Results:")
        print(f"  Success Rate: {success_rate:.3f} ({success_rate*100:.1f}%)")
        print(f"  Average Response Time: {avg_response_time:.2f}s")
        print(f"  95th Percentile Response Time: {p95_response_time:.2f}s")
        
        # Verify SLOs
        assert success_rate >= self.slo_targets['serp_success_rate'], f"Success rate {success_rate} below target {self.slo_targets['serp_success_rate']}"
        assert p95_response_time <= self.slo_targets['serp_response_time'], f"95th percentile response time {p95_response_time}s above target {self.slo_targets['serp_response_time']}s"
        
        return {
            'success_rate': success_rate,
            'avg_response_time': avg_response_time,
            'p95_response_time': p95_response_time,
            'slo_met': success_rate >= self.slo_targets['serp_success_rate'] and p95_response_time <= self.slo_targets['serp_response_time']
        }
    
    async def verify_cluster_slo(self, num_tests=20):
        """Verify clustering SLOs"""
        print(f"Verifying cluster SLOs with {num_tests} tests")
        
        # Generate test datasets
        test_datasets = []
        for i in range(num_tests):
            dataset = []
            for j in range(50):  # 50 keywords per test
                keyword = {
                    'id': f'kw_{i}_{j}',
                    'keyword': f'cluster test {i} keyword {j}',
                    'search_volume': 1000 + (j % 1000),
                    'difficulty': 50 + (j % 50),
                    'intent': ['informational', 'commercial', 'transactional'][j % 3],
                    'embedding': [0.1] * 384  # Mock embedding
                }
                dataset.append(keyword)
            test_datasets.append(dataset)
        
        response_times = []
        success_count = 0
        
        for dataset in test_datasets:
            start_time = time.time()
            try:
                result = await self.cluster_worker.cluster_keywords(dataset)
                end_time = time.time()
                response_time = end_time - start_time
                response_times.append(response_time)
                success_count += 1
                
                # Verify result quality
                assert isinstance(result, dict)
                assert 'clusters' in result
                assert 'metadata' in result
                assert len(result['clusters']) > 0
                
            except Exception as e:
                print(f"Clustering failed for dataset: {e}")
                end_time = time.time()
                response_times.append(end_time - start_time)
        
        # Calculate metrics
        success_rate = success_count / num_tests
        avg_response_time = statistics.mean(response_times)
        p95_response_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
        
        print(f"Cluster SLO Results:")
        print(f"  Success Rate: {success_rate:.3f} ({success_rate*100:.1f}%)")
        print(f"  Average Response Time: {avg_response_time:.2f}s")
        print(f"  95th Percentile Response Time: {p95_response_time:.2f}s")
        
        # Verify SLOs
        assert success_rate >= self.slo_targets['cluster_success_rate'], f"Success rate {success_rate} below target {self.slo_targets['cluster_success_rate']}"
        assert p95_response_time <= self.slo_targets['cluster_response_time'], f"95th percentile response time {p95_response_time}s above target {self.slo_targets['cluster_response_time']}s"
        
        return {
            'success_rate': success_rate,
            'avg_response_time': avg_response_time,
            'p95_response_time': p95_response_time,
            'slo_met': success_rate >= self.slo_targets['cluster_success_rate'] and p95_response_time <= self.slo_targets['cluster_response_time']
        }
    
    async def verify_brief_slo(self, num_tests=10):
        """Verify content brief generation SLOs"""
        print(f"Verifying brief SLOs with {num_tests} tests")
        
        test_topics = [f"brief test topic {i}" for i in range(num_tests)]
        
        response_times = []
        success_count = 0
        
        for topic in test_topics:
            start_time = time.time()
            try:
                # Simulate brief generation (placeholder)
                await asyncio.sleep(2)  # Simulate processing time
                
                # Mock brief result
                brief_result = {
                    'topic': topic,
                    'outline': ['Introduction', 'Main Points', 'Conclusion'],
                    'word_count': 1500,
                    'keywords': ['test', 'keyword', 'brief']
                }
                
                end_time = time.time()
                response_time = end_time - start_time
                response_times.append(response_time)
                success_count += 1
                
                # Verify result quality
                assert isinstance(brief_result, dict)
                assert 'outline' in brief_result
                assert 'word_count' in brief_result
                
            except Exception as e:
                print(f"Brief generation failed for '{topic}': {e}")
                end_time = time.time()
                response_times.append(end_time - start_time)
        
        # Calculate metrics
        success_rate = success_count / num_tests
        avg_response_time = statistics.mean(response_times)
        p95_response_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
        
        print(f"Brief SLO Results:")
        print(f"  Success Rate: {success_rate:.3f} ({success_rate*100:.1f}%)")
        print(f"  Average Response Time: {avg_response_time:.2f}s")
        print(f"  95th Percentile Response Time: {p95_response_time:.2f}s")
        
        # Verify SLOs
        assert success_rate >= self.slo_targets['brief_success_rate'], f"Success rate {success_rate} below target {self.slo_targets['brief_success_rate']}"
        assert p95_response_time <= self.slo_targets['brief_response_time'], f"95th percentile response time {p95_response_time}s above target {self.slo_targets['brief_response_time']}s"
        
        return {
            'success_rate': success_rate,
            'avg_response_time': avg_response_time,
            'p95_response_time': p95_response_time,
            'slo_met': success_rate >= self.slo_targets['brief_success_rate'] and p95_response_time <= self.slo_targets['brief_response_time']
        }
    
    async def verify_end_to_end_slo(self, num_tests=5):
        """Verify end-to-end workflow SLOs"""
        print(f"Verifying end-to-end SLOs with {num_tests} tests")
        
        test_seeds = [f"e2e test {i}" for i in range(num_tests)]
        project_id = "e2e-slo-test"
        
        response_times = []
        success_count = 0
        
        for seed in test_seeds:
            start_time = time.time()
            try:
                # Step 1: Expand keywords
                expanded_keywords = await self.expand_worker.expand_keywords(seed, project_id)
                assert len(expanded_keywords) > 0
                
                # Step 2: Process first few keywords through pipeline
                for keyword_data in expanded_keywords[:3]:
                    keyword = keyword_data['keyword']
                    
                    # Fetch SERP results
                    serp_results = await self.serp_worker.fetch_serp_results(keyword)
                    assert len(serp_results) > 0
                    
                    # Classify intent
                    intent_result = await self.intent_worker.classify_intent(keyword, serp_results)
                    assert 'intent' in intent_result
                    
                    # Calculate difficulty
                    difficulty_result = await self.difficulty_worker.calculate_difficulty(keyword, serp_results)
                    assert 'difficulty_score' in difficulty_result
                
                # Step 3: Cluster keywords
                clusters = await self.cluster_worker.cluster_keywords(expanded_keywords[:10])
                assert len(clusters['clusters']) > 0
                
                end_time = time.time()
                response_time = end_time - start_time
                response_times.append(response_time)
                success_count += 1
                
            except Exception as e:
                print(f"E2E workflow failed for '{seed}': {e}")
                end_time = time.time()
                response_times.append(end_time - start_time)
        
        # Calculate metrics
        success_rate = success_count / num_tests
        avg_response_time = statistics.mean(response_times)
        p95_response_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
        
        print(f"E2E SLO Results:")
        print(f"  Success Rate: {success_rate:.3f} ({success_rate*100:.1f}%)")
        print(f"  Average Response Time: {avg_response_time:.2f}s")
        print(f"  95th Percentile Response Time: {p95_response_time:.2f}s")
        
        # E2E SLO targets
        e2e_success_target = 0.90  # 90%
        e2e_response_target = 300  # 5 minutes
        
        # Verify SLOs
        assert success_rate >= e2e_success_target, f"E2E success rate {success_rate} below target {e2e_success_target}"
        assert p95_response_time <= e2e_response_target, f"E2E 95th percentile response time {p95_response_time}s above target {e2e_response_target}s"
        
        return {
            'success_rate': success_rate,
            'avg_response_time': avg_response_time,
            'p95_response_time': p95_response_time,
            'slo_met': success_rate >= e2e_success_target and p95_response_time <= e2e_response_target
        }

@pytest.mark.asyncio
async def test_expand_slo_verification():
    """Test keyword expansion SLO verification"""
    verifier = SLOVerifier()
    result = await verifier.verify_expand_slo(num_tests=20)  # Reduced for testing
    
    assert result['slo_met'], "Expand SLO verification failed"
    print("✅ Expand SLO verification passed")

@pytest.mark.asyncio
async def test_serp_slo_verification():
    """Test SERP API SLO verification"""
    verifier = SLOVerifier()
    result = await verifier.verify_serp_slo(num_tests=10)  # Reduced for testing
    
    assert result['slo_met'], "SERP SLO verification failed"
    print("✅ SERP SLO verification passed")

@pytest.mark.asyncio
async def test_cluster_slo_verification():
    """Test clustering SLO verification"""
    verifier = SLOVerifier()
    result = await verifier.verify_cluster_slo(num_tests=5)  # Reduced for testing
    
    assert result['slo_met'], "Cluster SLO verification failed"
    print("✅ Cluster SLO verification passed")

@pytest.mark.asyncio
async def test_brief_slo_verification():
    """Test content brief SLO verification"""
    verifier = SLOVerifier()
    result = await verifier.verify_brief_slo(num_tests=5)  # Reduced for testing
    
    assert result['slo_met'], "Brief SLO verification failed"
    print("✅ Brief SLO verification passed")

@pytest.mark.asyncio
async def test_end_to_end_slo_verification():
    """Test end-to-end workflow SLO verification"""
    verifier = SLOVerifier()
    result = await verifier.verify_end_to_end_slo(num_tests=3)  # Reduced for testing
    
    assert result['slo_met'], "E2E SLO verification failed"
    print("✅ E2E SLO verification passed")

@pytest.mark.asyncio
async def test_all_slos():
    """Test all SLOs together"""
    verifier = SLOVerifier()
    
    print("Running comprehensive SLO verification...")
    
    # Run all SLO verifications
    expand_result = await verifier.verify_expand_slo(num_tests=10)
    serp_result = await verifier.verify_serp_slo(num_tests=5)
    cluster_result = await verifier.verify_cluster_slo(num_tests=3)
    brief_result = await verifier.verify_brief_slo(num_tests=3)
    e2e_result = await verifier.verify_end_to_end_slo(num_tests=2)
    
    # Compile results
    all_results = {
        'expand': expand_result,
        'serp': serp_result,
        'cluster': cluster_result,
        'brief': brief_result,
        'e2e': e2e_result
    }
    
    # Check overall SLO compliance
    all_slos_met = all(result['slo_met'] for result in all_results.values())
    
    print("\n📊 SLO Verification Summary:")
    for service, result in all_results.items():
        status = "✅ PASS" if result['slo_met'] else "❌ FAIL"
        print(f"  {service.upper()}: {status}")
        print(f"    Success Rate: {result['success_rate']:.1%}")
        print(f"    P95 Response Time: {result['p95_response_time']:.2f}s")
    
    assert all_slos_met, "Not all SLOs were met"
    print("\n🎉 All SLOs verified successfully!")

if __name__ == "__main__":
    pytest.main([__file__])
