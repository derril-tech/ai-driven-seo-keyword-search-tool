import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import redis
import json
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class UsageEvent:
    org_id: str
    action: str
    timestamp: datetime
    metadata: Dict[str, Any]

@dataclass
class QuotaAlert:
    org_id: str
    quota_type: str
    current_usage: int
    limit: int
    percentage: float
    timestamp: datetime
    severity: str  # 'warning', 'critical'

class UsageMeteringService:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_client = redis.from_url(redis_url)
        self.logger = logger
        
        # Alert thresholds
        self.warning_threshold = 0.8  # 80%
        self.critical_threshold = 0.95  # 95%
        
        # Quota types
        self.quota_types = ['seeds_per_day', 'serp_calls_per_day', 'exports_per_day']
    
    async def record_usage(self, org_id: str, action: str, metadata: Dict[str, Any] = None) -> None:
        """Record a usage event for an organization"""
        try:
            event = UsageEvent(
                org_id=org_id,
                action=action,
                timestamp=datetime.utcnow(),
                metadata=metadata or {}
            )
            
            # Store event in Redis with TTL
            event_key = f"usage:event:{org_id}:{action}:{event.timestamp.timestamp()}"
            event_data = {
                'org_id': event.org_id,
                'action': event.action,
                'timestamp': event.timestamp.isoformat(),
                'metadata': event.metadata
            }
            
            # Set TTL based on action type
            ttl = self._get_ttl_for_action(action)
            self.redis_client.setex(event_key, ttl, json.dumps(event_data))
            
            # Update daily counter
            await self._update_daily_counter(org_id, action)
            
            # Check quotas and send alerts if needed
            await self._check_quotas_and_alert(org_id, action)
            
            self.logger.info(f"Recorded usage: {action} for org {org_id}")
            
        except Exception as e:
            self.logger.error(f"Error recording usage: {e}")
            raise
    
    async def get_usage_metrics(self, org_id: str, action: str, period: str = 'day') -> Dict[str, Any]:
        """Get usage metrics for an organization"""
        try:
            if period == 'day':
                return await self._get_daily_usage(org_id, action)
            elif period == 'week':
                return await self._get_weekly_usage(org_id, action)
            elif period == 'month':
                return await self._get_monthly_usage(org_id, action)
            else:
                raise ValueError(f"Unsupported period: {period}")
                
        except Exception as e:
            self.logger.error(f"Error getting usage metrics: {e}")
            raise
    
    async def check_quota(self, org_id: str, action: str) -> Dict[str, Any]:
        """Check if organization has quota for an action"""
        try:
            # Get current usage
            usage = await self.get_usage_metrics(org_id, action, 'day')
            current_usage = usage.get('count', 0)
            
            # Get quota limit (this would typically come from billing service)
            limit = await self._get_quota_limit(org_id, action)
            
            has_quota = current_usage < limit
            percentage = (current_usage / limit) * 100 if limit > 0 else 0
            
            return {
                'has_quota': has_quota,
                'current_usage': current_usage,
                'limit': limit,
                'percentage': percentage,
                'remaining': max(0, limit - current_usage)
            }
            
        except Exception as e:
            self.logger.error(f"Error checking quota: {e}")
            raise
    
    async def get_usage_report(self, org_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Generate comprehensive usage report"""
        try:
            report = {
                'org_id': org_id,
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'metrics': {},
                'alerts': [],
                'trends': {}
            }
            
            # Get metrics for each action type
            for action in self.quota_types:
                report['metrics'][action] = await self._get_usage_for_period(org_id, action, start_date, end_date)
            
            # Get alerts for the period
            report['alerts'] = await self._get_alerts_for_period(org_id, start_date, end_date)
            
            # Get usage trends
            report['trends'] = await self._get_usage_trends(org_id, start_date, end_date)
            
            return report
            
        except Exception as e:
            self.logger.error(f"Error generating usage report: {e}")
            raise
    
    async def send_quota_alert(self, alert: QuotaAlert) -> None:
        """Send quota alert to organization"""
        try:
            # Store alert in Redis
            alert_key = f"quota:alert:{alert.org_id}:{alert.quota_type}:{alert.timestamp.timestamp()}"
            alert_data = {
                'org_id': alert.org_id,
                'quota_type': alert.quota_type,
                'current_usage': alert.current_usage,
                'limit': alert.limit,
                'percentage': alert.percentage,
                'timestamp': alert.timestamp.isoformat(),
                'severity': alert.severity
            }
            
            # Store for 30 days
            self.redis_client.setex(alert_key, 30 * 24 * 3600, json.dumps(alert_data))
            
            # Send notification (this would integrate with notification service)
            await self._send_notification(alert)
            
            self.logger.warning(f"Quota alert sent: {alert.severity} - {alert.quota_type} at {alert.percentage}% for org {alert.org_id}")
            
        except Exception as e:
            self.logger.error(f"Error sending quota alert: {e}")
            raise
    
    def _get_ttl_for_action(self, action: str) -> int:
        """Get TTL for usage events based on action type"""
        if action == 'seeds_per_day':
            return 24 * 3600  # 24 hours
        elif action == 'serp_calls_per_day':
            return 24 * 3600  # 24 hours
        elif action == 'exports_per_day':
            return 24 * 3600  # 24 hours
        else:
            return 24 * 3600  # Default 24 hours
    
    async def _update_daily_counter(self, org_id: str, action: str) -> None:
        """Update daily usage counter"""
        try:
            today = datetime.utcnow().strftime('%Y-%m-%d')
            counter_key = f"usage:counter:{org_id}:{action}:{today}"
            
            # Increment counter
            self.redis_client.incr(counter_key)
            
            # Set TTL to ensure cleanup
            self.redis_client.expire(counter_key, 48 * 3600)  # 48 hours
            
        except Exception as e:
            self.logger.error(f"Error updating daily counter: {e}")
            raise
    
    async def _get_daily_usage(self, org_id: str, action: str) -> Dict[str, Any]:
        """Get daily usage for an action"""
        try:
            today = datetime.utcnow().strftime('%Y-%m-%d')
            counter_key = f"usage:counter:{org_id}:{action}:{today}"
            
            count = self.redis_client.get(counter_key)
            count = int(count) if count else 0
            
            return {
                'date': today,
                'action': action,
                'count': count
            }
            
        except Exception as e:
            self.logger.error(f"Error getting daily usage: {e}")
            raise
    
    async def _get_weekly_usage(self, org_id: str, action: str) -> Dict[str, Any]:
        """Get weekly usage for an action"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=7)
            
            total_count = 0
            daily_counts = []
            
            current_date = start_date
            while current_date <= end_date:
                date_str = current_date.strftime('%Y-%m-%d')
                counter_key = f"usage:counter:{org_id}:{action}:{date_str}"
                
                count = self.redis_client.get(counter_key)
                count = int(count) if count else 0
                
                total_count += count
                daily_counts.append({
                    'date': date_str,
                    'count': count
                })
                
                current_date += timedelta(days=1)
            
            return {
                'period': 'week',
                'action': action,
                'total_count': total_count,
                'daily_counts': daily_counts
            }
            
        except Exception as e:
            self.logger.error(f"Error getting weekly usage: {e}")
            raise
    
    async def _get_monthly_usage(self, org_id: str, action: str) -> Dict[str, Any]:
        """Get monthly usage for an action"""
        try:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=30)
            
            total_count = 0
            daily_counts = []
            
            current_date = start_date
            while current_date <= end_date:
                date_str = current_date.strftime('%Y-%m-%d')
                counter_key = f"usage:counter:{org_id}:{action}:{date_str}"
                
                count = self.redis_client.get(counter_key)
                count = int(count) if count else 0
                
                total_count += count
                daily_counts.append({
                    'date': date_str,
                    'count': count
                })
                
                current_date += timedelta(days=1)
            
            return {
                'period': 'month',
                'action': action,
                'total_count': total_count,
                'daily_counts': daily_counts
            }
            
        except Exception as e:
            self.logger.error(f"Error getting monthly usage: {e}")
            raise
    
    async def _get_quota_limit(self, org_id: str, action: str) -> int:
        """Get quota limit for an organization and action"""
        try:
            # This would typically query the billing service or database
            # For now, return default limits
            default_limits = {
                'seeds_per_day': 100,
                'serp_calls_per_day': 500,
                'exports_per_day': 25
            }
            
            return default_limits.get(action, 100)
            
        except Exception as e:
            self.logger.error(f"Error getting quota limit: {e}")
            raise
    
    async def _check_quotas_and_alert(self, org_id: str, action: str) -> None:
        """Check quotas and send alerts if needed"""
        try:
            quota_info = await self.check_quota(org_id, action)
            
            if quota_info['percentage'] >= self.critical_threshold * 100:
                alert = QuotaAlert(
                    org_id=org_id,
                    quota_type=action,
                    current_usage=quota_info['current_usage'],
                    limit=quota_info['limit'],
                    percentage=quota_info['percentage'],
                    timestamp=datetime.utcnow(),
                    severity='critical'
                )
                await self.send_quota_alert(alert)
                
            elif quota_info['percentage'] >= self.warning_threshold * 100:
                alert = QuotaAlert(
                    org_id=org_id,
                    quota_type=action,
                    current_usage=quota_info['current_usage'],
                    limit=quota_info['limit'],
                    percentage=quota_info['percentage'],
                    timestamp=datetime.utcnow(),
                    severity='warning'
                )
                await self.send_quota_alert(alert)
                
        except Exception as e:
            self.logger.error(f"Error checking quotas and alerts: {e}")
            raise
    
    async def _get_usage_for_period(self, org_id: str, action: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get usage for a specific period"""
        try:
            total_count = 0
            daily_counts = []
            
            current_date = start_date
            while current_date <= end_date:
                date_str = current_date.strftime('%Y-%m-%d')
                counter_key = f"usage:counter:{org_id}:{action}:{date_str}"
                
                count = self.redis_client.get(counter_key)
                count = int(count) if count else 0
                
                total_count += count
                daily_counts.append({
                    'date': date_str,
                    'count': count
                })
                
                current_date += timedelta(days=1)
            
            return {
                'action': action,
                'total_count': total_count,
                'daily_counts': daily_counts
            }
            
        except Exception as e:
            self.logger.error(f"Error getting usage for period: {e}")
            raise
    
    async def _get_alerts_for_period(self, org_id: str, start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Get alerts for a specific period"""
        try:
            alerts = []
            
            # This would query the alerts stored in Redis
            # For now, return empty list
            return alerts
            
        except Exception as e:
            self.logger.error(f"Error getting alerts for period: {e}")
            raise
    
    async def _get_usage_trends(self, org_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Get usage trends for the period"""
        try:
            trends = {}
            
            for action in self.quota_types:
                usage_data = await self._get_usage_for_period(org_id, action, start_date, end_date)
                
                if usage_data['daily_counts']:
                    counts = [day['count'] for day in usage_data['daily_counts']]
                    trends[action] = {
                        'total': sum(counts),
                        'average': sum(counts) / len(counts),
                        'max': max(counts),
                        'min': min(counts),
                        'trend': 'increasing' if counts[-1] > counts[0] else 'decreasing' if counts[-1] < counts[0] else 'stable'
                    }
            
            return trends
            
        except Exception as e:
            self.logger.error(f"Error getting usage trends: {e}")
            raise
    
    async def _send_notification(self, alert: QuotaAlert) -> None:
        """Send notification for quota alert"""
        try:
            # This would integrate with notification service (email, Slack, etc.)
            # For now, just log the alert
            self.logger.warning(f"Quota alert notification: {alert.severity} - {alert.quota_type} at {alert.percentage}% for org {alert.org_id}")
            
        except Exception as e:
            self.logger.error(f"Error sending notification: {e}")
            raise
