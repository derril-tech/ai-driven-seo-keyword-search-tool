import asyncio
import aiohttp
import time
import logging
from typing import Dict, Any, Optional, List
from urllib.parse import urlparse
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

@dataclass
class RobotsTxtRule:
    """Represents a robots.txt rule"""
    user_agent: str
    allow: List[str]
    disallow: List[str]
    crawl_delay: Optional[int] = None

@dataclass
class RateLimitConfig:
    """Rate limiting configuration"""
    requests_per_minute: int
    requests_per_hour: int
    burst_limit: int
    cooldown_period: int = 60

class RobotsCompliance:
    """
    Handles robots.txt compliance and crawling etiquette
    """
    
    def __init__(self):
        self.robots_cache = {}
        self.last_request_times = {}
        self.crawl_delays = {}
    
    async def check_robots_txt(self, url: str, user_agent: str = "AI-SEO-Tool/1.0") -> bool:
        """
        Check if a URL is allowed by robots.txt
        """
        domain = urlparse(url).netloc
        robots_url = f"https://{domain}/robots.txt"
        
        # Check cache first
        cache_key = f"{domain}:{user_agent}"
        if cache_key in self.robots_cache:
            return self.robots_cache[cache_key]
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(robots_url, headers={'User-Agent': user_agent}) as response:
                    if response.status == 200:
                        robots_content = await response.text()
                        is_allowed = self._parse_robots_txt(robots_content, url, user_agent)
                        self.robots_cache[cache_key] = is_allowed
                        return is_allowed
                    else:
                        # If robots.txt is not found, assume allowed
                        self.robots_cache[cache_key] = True
                        return True
        except Exception as e:
            logger.warning(f"Failed to fetch robots.txt for {domain}: {e}")
            # On error, assume allowed but be conservative
            self.robots_cache[cache_key] = True
            return True
    
    def _parse_robots_txt(self, content: str, url: str, user_agent: str) -> bool:
        """
        Parse robots.txt content and check if URL is allowed
        """
        lines = content.split('\n')
        current_agent = None
        rules = RobotsTxtRule(user_agent="*", allow=[], disallow=[])
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip().lower()
                value = value.strip()
                
                if key == 'user-agent':
                    if value == '*' or value.lower() == user_agent.lower():
                        current_agent = value
                        rules = RobotsTxtRule(user_agent=value, allow=[], disallow=[])
                elif key == 'allow' and current_agent:
                    rules.allow.append(value)
                elif key == 'disallow' and current_agent:
                    rules.disallow.append(value)
                elif key == 'crawl-delay' and current_agent:
                    try:
                        rules.crawl_delay = int(value)
                    except ValueError:
                        pass
        
        return self._check_url_allowed(url, rules)
    
    def _check_url_allowed(self, url: str, rules: RobotsTxtRule) -> bool:
        """
        Check if a specific URL is allowed by the robots.txt rules
        """
        path = urlparse(url).path
        
        # Check disallow rules first
        for disallow_path in rules.disallow:
            if path.startswith(disallow_path):
                return False
        
        # Check allow rules
        for allow_path in rules.allow:
            if path.startswith(allow_path):
                return True
        
        # If no specific allow rules, default to allowed
        return True
    
    async def respect_crawl_delay(self, domain: str, user_agent: str = "AI-SEO-Tool/1.0"):
        """
        Respect crawl delay for a domain
        """
        cache_key = f"{domain}:{user_agent}"
        if cache_key in self.crawl_delays:
            delay = self.crawl_delays[cache_key]
            if delay > 0:
                await asyncio.sleep(delay)

class RateLimiter:
    """
    Implements rate limiting for API calls and web scraping
    """
    
    def __init__(self):
        self.request_history = {}
        self.configs = {}
    
    def configure_limiter(self, key: str, config: RateLimitConfig):
        """
        Configure rate limiting for a specific key (domain, API, etc.)
        """
        self.configs[key] = config
        if key not in self.request_history:
            self.request_history[key] = []
    
    async def check_rate_limit(self, key: str) -> bool:
        """
        Check if a request is allowed under rate limiting
        """
        if key not in self.configs:
            return True  # No rate limiting configured
        
        config = self.configs[key]
        now = time.time()
        
        # Clean old requests
        self.request_history[key] = [
            req_time for req_time in self.request_history[key]
            if now - req_time < 3600  # Keep last hour
        ]
        
        # Check burst limit
        recent_requests = len([
            req_time for req_time in self.request_history[key]
            if now - req_time < 60  # Last minute
        ])
        
        if recent_requests >= config.burst_limit:
            return False
        
        # Check hourly limit
        hourly_requests = len([
            req_time for req_time in self.request_history[key]
            if now - req_time < 3600  # Last hour
        ])
        
        if hourly_requests >= config.requests_per_hour:
            return False
        
        # Add current request
        self.request_history[key].append(now)
        return True
    
    async def wait_for_rate_limit(self, key: str):
        """
        Wait if rate limit is exceeded
        """
        while not await self.check_rate_limit(key):
            await asyncio.sleep(1)

class SecurityManager:
    """
    Main security manager that combines robots compliance and rate limiting
    """
    
    def __init__(self):
        self.robots = RobotsCompliance()
        self.rate_limiter = RateLimiter()
        
        # Configure default rate limits
        self.rate_limiter.configure_limiter(
            "default",
            RateLimitConfig(
                requests_per_minute=60,
                requests_per_hour=1000,
                burst_limit=10
            )
        )
    
    async def can_fetch_url(self, url: str, user_agent: str = "AI-SEO-Tool/1.0") -> bool:
        """
        Check if a URL can be fetched (robots.txt + rate limiting)
        """
        domain = urlparse(url).netloc
        
        # Check robots.txt
        if not await self.robots.check_robots_txt(url, user_agent):
            logger.info(f"URL {url} disallowed by robots.txt")
            return False
        
        # Check rate limiting
        if not await self.rate_limiter.check_rate_limit(domain):
            logger.info(f"Rate limit exceeded for domain {domain}")
            return False
        
        return True
    
    async def fetch_url_safely(self, url: str, user_agent: str = "AI-SEO-Tool/1.0", **kwargs) -> Optional[str]:
        """
        Safely fetch a URL with all security checks
        """
        domain = urlparse(url).netloc
        
        # Check if we can fetch
        if not await self.can_fetch_url(url, user_agent):
            return None
        
        # Wait for rate limit if needed
        await self.rate_limiter.wait_for_rate_limit(domain)
        
        # Respect crawl delay
        await self.robots.respect_crawl_delay(domain, user_agent)
        
        try:
            headers = {
                'User-Agent': user_agent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers, timeout=30, **kwargs) as response:
                    if response.status == 200:
                        return await response.text()
                    else:
                        logger.warning(f"HTTP {response.status} for {url}")
                        return None
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            return None
    
    def sanitize_url(self, url: str) -> str:
        """
        Sanitize URL to prevent injection attacks
        """
        parsed = urlparse(url)
        
        # Ensure scheme is http or https
        if parsed.scheme not in ['http', 'https']:
            url = f"https://{url}"
        
        # Remove potentially dangerous characters
        url = url.replace('<', '').replace('>', '').replace('"', '').replace("'", '')
        
        return url
    
    def validate_domain(self, domain: str) -> bool:
        """
        Validate domain name
        """
        import re
        domain_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
        return bool(re.match(domain_pattern, domain))

# Example usage
async def main():
    security = SecurityManager()
    
    # Configure rate limiting for a specific domain
    security.rate_limiter.configure_limiter(
        "example.com",
        RateLimitConfig(
            requests_per_minute=30,
            requests_per_hour=500,
            burst_limit=5
        )
    )
    
    # Safely fetch a URL
    url = "https://example.com/page"
    content = await security.fetch_url_safely(url)
    
    if content:
        print(f"Successfully fetched {url}")
    else:
        print(f"Failed to fetch {url}")

if __name__ == "__main__":
    asyncio.run(main())
