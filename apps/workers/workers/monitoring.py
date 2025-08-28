import time
import logging
from functools import wraps
from typing import Dict, Any, Optional
from prometheus_client import Counter, Histogram, Gauge, Summary
import structlog
import asyncio

logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter('ai_seo_worker_requests_total', 'Total requests processed', ['worker_type', 'endpoint'])
REQUEST_DURATION = Histogram('ai_seo_worker_request_duration_seconds', 'Request duration in seconds', ['worker_type', 'endpoint'])
PROCESSING_TIME = Histogram('ai_seo_worker_processing_time_seconds', 'Processing time in seconds', ['worker_type'])
ERROR_COUNT = Counter('ai_seo_worker_errors_total', 'Total errors', ['worker_type', 'error_type'])
ACTIVE_JOBS = Gauge('ai_seo_active_jobs', 'Number of active jobs', ['worker_type'])
KEYWORDS_PROCESSED = Counter('ai_seo_keywords_processed_total', 'Total keywords processed', ['worker_type'])
SERP_API_CALLS = Counter('ai_seo_serp_api_calls_total', 'Total SERP API calls', ['provider'])
SERP_API_QUOTA = Gauge('ai_seo_serp_api_quota_remaining', 'Remaining SERP API quota', ['provider'])

def monitor_function(worker_type: str, function_name: str = None):
    """
    Decorator to monitor function execution with Prometheus metrics
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            endpoint = function_name or func.__name__
            
            # Increment active jobs
            ACTIVE_JOBS.labels(worker_type=worker_type).inc()
            
            try:
                # Execute function
                result = await func(*args, **kwargs)
                
                # Record success metrics
                REQUEST_COUNT.labels(worker_type=worker_type, endpoint=endpoint).inc()
                duration = time.time() - start_time
                REQUEST_DURATION.labels(worker_type=worker_type, endpoint=endpoint).observe(duration)
                PROCESSING_TIME.labels(worker_type=worker_type).observe(duration)
                
                logger.info(
                    "function_completed",
                    worker_type=worker_type,
                    function=endpoint,
                    duration=duration,
                    status="success"
                )
                
                return result
                
            except Exception as e:
                # Record error metrics
                ERROR_COUNT.labels(worker_type=worker_type, error_type=type(e).__name__).inc()
                duration = time.time() - start_time
                
                logger.error(
                    "function_failed",
                    worker_type=worker_type,
                    function=endpoint,
                    duration=duration,
                    error=str(e),
                    error_type=type(e).__name__
                )
                
                raise
            finally:
                # Decrement active jobs
                ACTIVE_JOBS.labels(worker_type=worker_type).dec()
        
        return wrapper
    return decorator

class MetricsCollector:
    """
    Utility class for collecting and reporting metrics
    """
    
    def __init__(self, worker_type: str):
        self.worker_type = worker_type
    
    def record_keywords_processed(self, count: int):
        """Record the number of keywords processed"""
        KEYWORDS_PROCESSED.labels(worker_type=self.worker_type).inc(count)
    
    def record_serp_api_call(self, provider: str):
        """Record a SERP API call"""
        SERP_API_CALLS.labels(provider=provider).inc()
    
    def update_serp_quota(self, provider: str, remaining: int):
        """Update SERP API quota remaining"""
        SERP_API_QUOTA.labels(provider=provider).set(remaining)
    
    def record_error(self, error_type: str):
        """Record an error"""
        ERROR_COUNT.labels(worker_type=self.worker_type, error_type=error_type).inc()
    
    def start_job(self):
        """Start tracking a job"""
        ACTIVE_JOBS.labels(worker_type=self.worker_type).inc()
    
    def end_job(self):
        """End tracking a job"""
        ACTIVE_JOBS.labels(worker_type=self.worker_type).dec()

class PerformanceMonitor:
    """
    Performance monitoring utilities
    """
    
    def __init__(self, worker_type: str):
        self.worker_type = worker_type
        self.metrics = MetricsCollector(worker_type)
    
    async def monitor_operation(self, operation_name: str, operation_func, *args, **kwargs):
        """
        Monitor an async operation with timing and error tracking
        """
        start_time = time.time()
        self.metrics.start_job()
        
        try:
            result = await operation_func(*args, **kwargs)
            
            duration = time.time() - start_time
            PROCESSING_TIME.labels(worker_type=self.worker_type).observe(duration)
            
            logger.info(
                "operation_completed",
                worker_type=self.worker_type,
                operation=operation_name,
                duration=duration,
                status="success"
            )
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            self.metrics.record_error(type(e).__name__)
            
            logger.error(
                "operation_failed",
                worker_type=self.worker_type,
                operation=operation_name,
                duration=duration,
                error=str(e),
                error_type=type(e).__name__
            )
            
            raise
        finally:
            self.metrics.end_job()

def setup_logging():
    """
    Setup structured logging with correlation IDs
    """
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

def log_request_context(request_id: str, user_id: str = None, project_id: str = None):
    """
    Add request context to logs
    """
    return structlog.get_logger().bind(
        request_id=request_id,
        user_id=user_id,
        project_id=project_id
    )

# Example usage
if __name__ == "__main__":
    setup_logging()
    
    # Example of using the monitoring decorator
    @monitor_function("expand_worker", "expand_keywords")
    async def expand_keywords(keyword: str):
        # Simulate work
        await asyncio.sleep(1)
        return ["expanded_keyword_1", "expanded_keyword_2"]
    
    # Example of using the performance monitor
    async def example_usage():
        monitor = PerformanceMonitor("expand_worker")
        
        # Monitor an operation
        result = await monitor.monitor_operation(
            "keyword_expansion",
            expand_keywords,
            "digital marketing"
        )
        
        # Record metrics
        monitor.metrics.record_keywords_processed(len(result))
        monitor.metrics.record_serp_api_call("serpapi")
        monitor.metrics.update_serp_quota("serpapi", 950)
        
        return result
