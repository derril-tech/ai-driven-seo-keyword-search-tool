import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple
import redis
import json
import time
from datetime import datetime, timedelta
from dataclasses import dataclass
import hashlib
from functools import wraps
import psutil
import gc
import numpy as np

logger = logging.getLogger(__name__)

@dataclass
class CacheMetrics:
    hits: int
    misses: int
    hit_rate: float
    total_requests: int
    avg_response_time: float
    memory_usage: float
    created_at: datetime

@dataclass
class PerformanceMetrics:
    query_count: int
    avg_query_time: float
    slow_queries: int
    cache_hit_rate: float
    memory_usage: float
    cpu_usage: float
    active_connections: int
    created_at: datetime

@dataclass
class OptimizationRecommendation:
    type: str  # 'cache', 'index', 'query', 'memory', 'connection'
    priority: str  # 'low', 'medium', 'high', 'critical'
    description: str
    impact: str
    implementation: str
    estimated_improvement: float
    created_at: datetime

class PerformanceOptimizer:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.logger = logger
        self.redis_client = redis.from_url(redis_url)
        
        # Cache configuration
        self.cache_ttl = {
            'keyword_data': 3600,  # 1 hour
            'serp_results': 1800,  # 30 minutes
            'cluster_data': 7200,  # 2 hours
            'user_sessions': 1800,  # 30 minutes
            'api_responses': 300,   # 5 minutes
        }
        
        # Performance thresholds
        self.thresholds = {
            'slow_query_time': 1.0,  # seconds
            'high_memory_usage': 80.0,  # percentage
            'high_cpu_usage': 70.0,  # percentage
            'low_cache_hit_rate': 60.0,  # percentage
        }
        
        # Metrics tracking
        self.metrics = {
            'cache_hits': 0,
            'cache_misses': 0,
            'query_times': [],
            'memory_usage': [],
            'cpu_usage': [],
        }
    
    async def cache_get(self, key: str, cache_type: str = 'api_responses') -> Optional[Any]:
        """Get value from cache with metrics tracking"""
        try:
            start_time = time.time()
            
            # Generate cache key
            cache_key = f"{cache_type}:{key}"
            
            # Try to get from cache
            cached_value = self.redis_client.get(cache_key)
            
            if cached_value:
                # Cache hit
                self.metrics['cache_hits'] += 1
                response_time = time.time() - start_time
                await self._record_cache_metrics('hit', response_time)
                
                return json.loads(cached_value)
            else:
                # Cache miss
                self.metrics['cache_misses'] += 1
                response_time = time.time() - start_time
                await self._record_cache_metrics('miss', response_time)
                
                return None
                
        except Exception as e:
            self.logger.error(f"Error in cache_get: {e}")
            return None
    
    async def cache_set(self, key: str, value: Any, cache_type: str = 'api_responses', 
                       ttl: Optional[int] = None) -> bool:
        """Set value in cache with TTL"""
        try:
            # Generate cache key
            cache_key = f"{cache_type}:{key}"
            
            # Serialize value
            serialized_value = json.dumps(value)
            
            # Set TTL
            if ttl is None:
                ttl = self.cache_ttl.get(cache_type, 300)
            
            # Store in cache
            self.redis_client.setex(cache_key, ttl, serialized_value)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error in cache_set: {e}")
            return False
    
    async def cache_invalidate(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern"""
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted = self.redis_client.delete(*keys)
                self.logger.info(f"Invalidated {deleted} cache entries matching pattern: {pattern}")
                return deleted
            return 0
            
        except Exception as e:
            self.logger.error(f"Error invalidating cache: {e}")
            return 0
    
    async def cache_warmup(self, data_source: str, keys: List[str]) -> Dict[str, bool]:
        """Warm up cache with frequently accessed data"""
        try:
            results = {}
            
            for key in keys:
                # Simulate data retrieval (in production, this would fetch from database)
                data = await self._fetch_data_for_cache(data_source, key)
                if data:
                    success = await self.cache_set(key, data, data_source)
                    results[key] = success
                else:
                    results[key] = False
            
            self.logger.info(f"Cache warmup completed: {sum(results.values())}/{len(keys)} successful")
            return results
            
        except Exception as e:
            self.logger.error(f"Error in cache warmup: {e}")
            return {}
    
    async def optimize_queries(self, query_patterns: List[Dict[str, Any]]) -> List[OptimizationRecommendation]:
        """Analyze and optimize database queries"""
        try:
            recommendations = []
            
            for pattern in query_patterns:
                query_type = pattern.get('type', 'unknown')
                avg_time = pattern.get('avg_time', 0)
                frequency = pattern.get('frequency', 0)
                query_text = pattern.get('query', '')
                
                # Analyze query performance
                if avg_time > self.thresholds['slow_query_time']:
                    recommendation = await self._analyze_slow_query(
                        query_type, query_text, avg_time, frequency
                    )
                    if recommendation:
                        recommendations.append(recommendation)
                
                # Check for missing indexes
                index_recommendation = await self._check_missing_indexes(query_text)
                if index_recommendation:
                    recommendations.append(index_recommendation)
            
            # Sort by priority
            recommendations.sort(key=lambda x: self._priority_score(x.priority), reverse=True)
            
            return recommendations
            
        except Exception as e:
            self.logger.error(f"Error optimizing queries: {e}")
            return []
    
    async def optimize_memory_usage(self) -> List[OptimizationRecommendation]:
        """Analyze and optimize memory usage"""
        try:
            recommendations = []
            
            # Get current memory usage
            memory_info = psutil.virtual_memory()
            memory_percent = memory_info.percent
            
            if memory_percent > self.thresholds['high_memory_usage']:
                # High memory usage detected
                recommendation = OptimizationRecommendation(
                    type='memory',
                    priority='high' if memory_percent > 90 else 'medium',
                    description=f"High memory usage detected: {memory_percent:.1f}%",
                    impact="May cause performance degradation and potential crashes",
                    implementation="Implement memory cleanup, optimize data structures, consider pagination",
                    estimated_improvement=20.0,
                    created_at=datetime.utcnow()
                )
                recommendations.append(recommendation)
            
            # Check for memory leaks
            leak_recommendation = await self._detect_memory_leaks()
            if leak_recommendation:
                recommendations.append(leak_recommendation)
            
            # Optimize cache memory
            cache_recommendation = await self._optimize_cache_memory()
            if cache_recommendation:
                recommendations.append(cache_recommendation)
            
            return recommendations
            
        except Exception as e:
            self.logger.error(f"Error optimizing memory usage: {e}")
            return []
    
    async def optimize_connections(self, connection_metrics: Dict[str, Any]) -> List[OptimizationRecommendation]:
        """Analyze and optimize database connections"""
        try:
            recommendations = []
            
            active_connections = connection_metrics.get('active', 0)
            max_connections = connection_metrics.get('max', 100)
            connection_usage = (active_connections / max_connections) * 100
            
            if connection_usage > 80:
                recommendation = OptimizationRecommendation(
                    type='connection',
                    priority='high',
                    description=f"High connection usage: {connection_usage:.1f}% ({active_connections}/{max_connections})",
                    impact="May cause connection timeouts and degraded performance",
                    implementation="Implement connection pooling, optimize query patterns, increase connection limits",
                    estimated_improvement=15.0,
                    created_at=datetime.utcnow()
                )
                recommendations.append(recommendation)
            
            # Check for connection leaks
            leak_recommendation = await self._detect_connection_leaks(connection_metrics)
            if leak_recommendation:
                recommendations.append(leak_recommendation)
            
            return recommendations
            
        except Exception as e:
            self.logger.error(f"Error optimizing connections: {e}")
            return []
    
    async def get_performance_metrics(self) -> PerformanceMetrics:
        """Get current performance metrics"""
        try:
            # Calculate cache hit rate
            total_requests = self.metrics['cache_hits'] + self.metrics['cache_misses']
            cache_hit_rate = (self.metrics['cache_hits'] / total_requests * 100) if total_requests > 0 else 0
            
            # Calculate average query time
            avg_query_time = np.mean(self.metrics['query_times']) if self.metrics['query_times'] else 0
            
            # Get system metrics
            memory_usage = psutil.virtual_memory().percent
            cpu_usage = psutil.cpu_percent(interval=1)
            
            # Count slow queries
            slow_queries = sum(1 for time in self.metrics['query_times'] if time > self.thresholds['slow_query_time'])
            
            metrics = PerformanceMetrics(
                query_count=len(self.metrics['query_times']),
                avg_query_time=avg_query_time,
                slow_queries=slow_queries,
                cache_hit_rate=cache_hit_rate,
                memory_usage=memory_usage,
                cpu_usage=cpu_usage,
                active_connections=0,  # Would be fetched from database
                created_at=datetime.utcnow()
            )
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error getting performance metrics: {e}")
            return PerformanceMetrics(0, 0, 0, 0, 0, 0, 0, datetime.utcnow())
    
    async def generate_optimization_report(self) -> Dict[str, Any]:
        """Generate comprehensive optimization report"""
        try:
            # Get current metrics
            metrics = await self.get_performance_metrics()
            
            # Generate recommendations
            query_recommendations = await self.optimize_queries([])  # Would use actual query patterns
            memory_recommendations = await self.optimize_memory_usage()
            connection_recommendations = await self.optimize_connections({})
            
            # Combine all recommendations
            all_recommendations = query_recommendations + memory_recommendations + connection_recommendations
            
            # Calculate overall health score
            health_score = await self._calculate_health_score(metrics)
            
            report = {
                'timestamp': datetime.utcnow().isoformat(),
                'health_score': health_score,
                'metrics': {
                    'cache_hit_rate': metrics.cache_hit_rate,
                    'avg_query_time': metrics.avg_query_time,
                    'memory_usage': metrics.memory_usage,
                    'cpu_usage': metrics.cpu_usage,
                    'slow_queries': metrics.slow_queries
                },
                'recommendations': [
                    {
                        'type': rec.type,
                        'priority': rec.priority,
                        'description': rec.description,
                        'impact': rec.impact,
                        'implementation': rec.implementation,
                        'estimated_improvement': rec.estimated_improvement
                    }
                    for rec in all_recommendations
                ],
                'summary': {
                    'total_recommendations': len(all_recommendations),
                    'critical_issues': len([r for r in all_recommendations if r.priority == 'critical']),
                    'high_priority': len([r for r in all_recommendations if r.priority == 'high']),
                    'estimated_total_improvement': sum(r.estimated_improvement for r in all_recommendations)
                }
            }
            
            return report
            
        except Exception as e:
            self.logger.error(f"Error generating optimization report: {e}")
            return {'error': str(e)}
    
    async def apply_optimizations(self, recommendations: List[OptimizationRecommendation]) -> Dict[str, bool]:
        """Apply optimization recommendations"""
        try:
            results = {}
            
            for recommendation in recommendations:
                try:
                    if recommendation.type == 'cache':
                        success = await self._apply_cache_optimization(recommendation)
                    elif recommendation.type == 'index':
                        success = await self._apply_index_optimization(recommendation)
                    elif recommendation.type == 'query':
                        success = await self._apply_query_optimization(recommendation)
                    elif recommendation.type == 'memory':
                        success = await self._apply_memory_optimization(recommendation)
                    elif recommendation.type == 'connection':
                        success = await self._apply_connection_optimization(recommendation)
                    else:
                        success = False
                    
                    results[recommendation.description] = success
                    
                except Exception as e:
                    self.logger.error(f"Error applying optimization {recommendation.description}: {e}")
                    results[recommendation.description] = False
            
            return results
            
        except Exception as e:
            self.logger.error(f"Error applying optimizations: {e}")
            return {}
    
    async def _record_cache_metrics(self, hit_or_miss: str, response_time: float):
        """Record cache performance metrics"""
        try:
            # Store metrics in Redis for aggregation
            metric_key = f"cache_metrics:{datetime.utcnow().strftime('%Y-%m-%d:%H')}"
            
            current_metrics = self.redis_client.hgetall(metric_key)
            if not current_metrics:
                current_metrics = {
                    'hits': '0',
                    'misses': '0',
                    'total_time': '0',
                    'count': '0'
                }
            
            # Update metrics
            if hit_or_miss == 'hit':
                current_metrics['hits'] = str(int(current_metrics['hits']) + 1)
            else:
                current_metrics['misses'] = str(int(current_metrics['misses']) + 1)
            
            current_metrics['total_time'] = str(float(current_metrics['total_time']) + response_time)
            current_metrics['count'] = str(int(current_metrics['count']) + 1)
            
            # Store updated metrics
            self.redis_client.hmset(metric_key, current_metrics)
            self.redis_client.expire(metric_key, 86400)  # 24 hours
            
        except Exception as e:
            self.logger.error(f"Error recording cache metrics: {e}")
    
    async def _fetch_data_for_cache(self, data_source: str, key: str) -> Optional[Dict[str, Any]]:
        """Fetch data for cache warmup (placeholder implementation)"""
        try:
            # This would typically fetch from database or external API
            # For now, return mock data
            return {
                'key': key,
                'source': data_source,
                'data': f"Mock data for {key}",
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error fetching data for cache: {e}")
            return None
    
    async def _analyze_slow_query(self, query_type: str, query_text: str, 
                                avg_time: float, frequency: int) -> Optional[OptimizationRecommendation]:
        """Analyze slow query and generate optimization recommendation"""
        try:
            # Simple analysis based on query characteristics
            if 'SELECT *' in query_text.upper():
                recommendation = OptimizationRecommendation(
                    type='query',
                    priority='high' if avg_time > 2.0 else 'medium',
                    description=f"Slow {query_type} query using SELECT *",
                    impact="Unnecessary data retrieval causing performance degradation",
                    implementation="Replace SELECT * with specific column names, add WHERE clauses",
                    estimated_improvement=30.0,
                    created_at=datetime.utcnow()
                )
                return recommendation
            
            elif 'ORDER BY' in query_text.upper() and 'LIMIT' not in query_text.upper():
                recommendation = OptimizationRecommendation(
                    type='query',
                    priority='medium',
                    description=f"Unoptimized {query_type} query with ORDER BY but no LIMIT",
                    impact="Sorting entire result set unnecessarily",
                    implementation="Add LIMIT clause, consider pagination",
                    estimated_improvement=20.0,
                    created_at=datetime.utcnow()
                )
                return recommendation
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error analyzing slow query: {e}")
            return None
    
    async def _check_missing_indexes(self, query_text: str) -> Optional[OptimizationRecommendation]:
        """Check for missing indexes in query"""
        try:
            # Simple index analysis (in production, use database-specific tools)
            if 'WHERE' in query_text.upper() and 'JOIN' in query_text.upper():
                recommendation = OptimizationRecommendation(
                    type='index',
                    priority='medium',
                    description="Potential missing indexes on JOIN conditions",
                    impact="Full table scans on joined tables",
                    implementation="Add indexes on JOIN columns, analyze query execution plan",
                    estimated_improvement=25.0,
                    created_at=datetime.utcnow()
                )
                return recommendation
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error checking missing indexes: {e}")
            return None
    
    async def _detect_memory_leaks(self) -> Optional[OptimizationRecommendation]:
        """Detect potential memory leaks"""
        try:
            # Simple memory leak detection (in production, use specialized tools)
            if len(self.metrics['memory_usage']) > 10:
                recent_usage = self.metrics['memory_usage'][-10:]
                if all(recent_usage[i] > recent_usage[i-1] for i in range(1, len(recent_usage))):
                    recommendation = OptimizationRecommendation(
                        type='memory',
                        priority='high',
                        description="Potential memory leak detected",
                        impact="Gradually increasing memory usage may lead to crashes",
                        implementation="Implement memory profiling, fix object references, add garbage collection",
                        estimated_improvement=40.0,
                        created_at=datetime.utcnow()
                    )
                    return recommendation
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error detecting memory leaks: {e}")
            return None
    
    async def _optimize_cache_memory(self) -> Optional[OptimizationRecommendation]:
        """Optimize cache memory usage"""
        try:
            # Check cache memory usage
            cache_info = self.redis_client.info('memory')
            used_memory = int(cache_info.get('used_memory', 0))
            max_memory = int(cache_info.get('maxmemory', 0))
            
            if max_memory > 0:
                memory_usage_percent = (used_memory / max_memory) * 100
                
                if memory_usage_percent > 80:
                    recommendation = OptimizationRecommendation(
                        type='cache',
                        priority='medium',
                        description=f"High cache memory usage: {memory_usage_percent:.1f}%",
                        impact="Cache evictions may reduce hit rate",
                        implementation="Adjust cache TTL, implement cache eviction policies, increase memory",
                        estimated_improvement=15.0,
                        created_at=datetime.utcnow()
                    )
                    return recommendation
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error optimizing cache memory: {e}")
            return None
    
    async def _detect_connection_leaks(self, connection_metrics: Dict[str, Any]) -> Optional[OptimizationRecommendation]:
        """Detect connection leaks"""
        try:
            # Simple connection leak detection
            active_connections = connection_metrics.get('active', 0)
            idle_connections = connection_metrics.get('idle', 0)
            
            if active_connections > 0 and idle_connections > active_connections * 2:
                recommendation = OptimizationRecommendation(
                    type='connection',
                    priority='medium',
                    description="Potential connection leak detected",
                    impact="Unused connections consuming resources",
                    implementation="Implement connection pooling, add connection timeouts, monitor connection lifecycle",
                    estimated_improvement=20.0,
                    created_at=datetime.utcnow()
                )
                return recommendation
            
            return None
            
        except Exception as e:
            self.logger.error(f"Error detecting connection leaks: {e}")
            return None
    
    async def _calculate_health_score(self, metrics: PerformanceMetrics) -> float:
        """Calculate overall system health score (0-100)"""
        try:
            score = 100.0
            
            # Deduct points for performance issues
            if metrics.cache_hit_rate < self.thresholds['low_cache_hit_rate']:
                score -= (self.thresholds['low_cache_hit_rate'] - metrics.cache_hit_rate) * 0.5
            
            if metrics.avg_query_time > self.thresholds['slow_query_time']:
                score -= (metrics.avg_query_time - self.thresholds['slow_query_time']) * 10
            
            if metrics.memory_usage > self.thresholds['high_memory_usage']:
                score -= (metrics.memory_usage - self.thresholds['high_memory_usage']) * 0.5
            
            if metrics.cpu_usage > self.thresholds['high_cpu_usage']:
                score -= (metrics.cpu_usage - self.thresholds['high_cpu_usage']) * 0.5
            
            return max(0.0, min(100.0, score))
            
        except Exception as e:
            self.logger.error(f"Error calculating health score: {e}")
            return 50.0
    
    def _priority_score(self, priority: str) -> int:
        """Convert priority string to numeric score"""
        priority_scores = {
            'critical': 4,
            'high': 3,
            'medium': 2,
            'low': 1
        }
        return priority_scores.get(priority, 0)
    
    async def _apply_cache_optimization(self, recommendation: OptimizationRecommendation) -> bool:
        """Apply cache optimization"""
        try:
            # Implement cache optimization logic
            # For now, just log the action
            self.logger.info(f"Applying cache optimization: {recommendation.description}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error applying cache optimization: {e}")
            return False
    
    async def _apply_index_optimization(self, recommendation: OptimizationRecommendation) -> bool:
        """Apply index optimization"""
        try:
            # Implement index optimization logic
            self.logger.info(f"Applying index optimization: {recommendation.description}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error applying index optimization: {e}")
            return False
    
    async def _apply_query_optimization(self, recommendation: OptimizationRecommendation) -> bool:
        """Apply query optimization"""
        try:
            # Implement query optimization logic
            self.logger.info(f"Applying query optimization: {recommendation.description}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error applying query optimization: {e}")
            return False
    
    async def _apply_memory_optimization(self, recommendation: OptimizationRecommendation) -> bool:
        """Apply memory optimization"""
        try:
            # Implement memory optimization logic
            self.logger.info(f"Applying memory optimization: {recommendation.description}")
            
            # Force garbage collection
            gc.collect()
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error applying memory optimization: {e}")
            return False
    
    async def _apply_connection_optimization(self, recommendation: OptimizationRecommendation) -> bool:
        """Apply connection optimization"""
        try:
            # Implement connection optimization logic
            self.logger.info(f"Applying connection optimization: {recommendation.description}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error applying connection optimization: {e}")
            return False
