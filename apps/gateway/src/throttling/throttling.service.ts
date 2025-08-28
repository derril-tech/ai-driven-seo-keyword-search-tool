import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../audit/audit.service';

export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    keyGenerator?: (req: any) => string;
}

export interface QuotaConfig {
    dailySeeds: number;
    dailySerpCalls: number;
    dailyExports: number;
    dailyApiCalls: number;
    monthlyDataTransfer: number; // in MB
    concurrentProjects: number;
    maxKeywordsPerProject: number;
    maxTeamMembers: number;
}

export interface UsageMetrics {
    seedsUsed: number;
    serpCallsUsed: number;
    exportsUsed: number;
    apiCallsUsed: number;
    dataTransferUsed: number;
    activeProjects: number;
    teamMembers: number;
}

@Injectable()
export class ThrottlingService {
    private readonly logger = new Logger(ThrottlingService.name);
    private readonly defaultQuotas: Record<string, QuotaConfig> = {
        free: {
            dailySeeds: 10,
            dailySerpCalls: 100,
            dailyExports: 5,
            dailyApiCalls: 1000,
            monthlyDataTransfer: 100,
            concurrentProjects: 3,
            maxKeywordsPerProject: 1000,
            maxTeamMembers: 1,
        },
        starter: {
            dailySeeds: 50,
            dailySerpCalls: 500,
            dailyExports: 25,
            dailyApiCalls: 5000,
            monthlyDataTransfer: 500,
            concurrentProjects: 10,
            maxKeywordsPerProject: 5000,
            maxTeamMembers: 5,
        },
        professional: {
            dailySeeds: 200,
            dailySerpCalls: 2000,
            dailyExports: 100,
            dailyApiCalls: 20000,
            monthlyDataTransfer: 2000,
            concurrentProjects: 50,
            maxKeywordsPerProject: 25000,
            maxTeamMembers: 20,
        },
        enterprise: {
            dailySeeds: 1000,
            dailySerpCalls: 10000,
            dailyExports: 500,
            dailyApiCalls: 100000,
            monthlyDataTransfer: 10000,
            concurrentProjects: 200,
            maxKeywordsPerProject: 100000,
            maxTeamMembers: 100,
        },
    };

    constructor(
        @InjectRepository(Tenant)
        private readonly tenantRepository: Repository<Tenant>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRedis() private readonly redis: Redis,
        private readonly auditService: AuditService,
    ) { }

    async checkRateLimit(
        userId: string,
        tenantId: string,
        endpoint: string,
        config: RateLimitConfig,
    ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
        const key = `rate_limit:${tenantId}:${userId}:${endpoint}`;
        const now = Date.now();
        const windowStart = now - config.windowMs;

        try {
            // Get current usage
            const usage = await this.redis.zrangebyscore(key, windowStart, '+inf');
            const currentCount = usage.length;

            if (currentCount >= config.maxRequests) {
                const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
                const resetTime = oldestRequest.length > 0
                    ? parseInt(oldestRequest[0][1]) + config.windowMs
                    : now + config.windowMs;

                // Log rate limit violation
                await this.auditService.logApiActivity(
                    { userId, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                    'rate_limit',
                    { endpoint, method: 'ANY', statusCode: 429, rateLimitExceeded: true }
                );

                return {
                    allowed: false,
                    remaining: 0,
                    resetTime,
                };
            }

            // Add current request
            await this.redis.zadd(key, now, `${now}-${Math.random()}`);
            await this.redis.expire(key, Math.ceil(config.windowMs / 1000));

            return {
                allowed: true,
                remaining: config.maxRequests - currentCount - 1,
                resetTime: now + config.windowMs,
            };
        } catch (error) {
            this.logger.error(`Rate limit check failed: ${error.message}`, error.stack);
            // Fail open in case of Redis issues
            return { allowed: true, remaining: 999, resetTime: now + config.windowMs };
        }
    }

    async checkQuota(
        tenantId: string,
        quotaType: keyof QuotaConfig,
        amount: number = 1,
    ): Promise<{ allowed: boolean; remaining: number; quota: number }> {
        try {
            const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
            if (!tenant) {
                throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
            }

            const plan = tenant.plan || 'free';
            const quota = this.defaultQuotas[plan][quotaType];

            if (!quota) {
                throw new HttpException(`Invalid quota type: ${quotaType}`, HttpStatus.BAD_REQUEST);
            }

            const usageKey = `quota:${tenantId}:${quotaType}:${this.getCurrentPeriod(quotaType)}`;
            const currentUsage = await this.redis.get(usageKey);
            const used = currentUsage ? parseInt(currentUsage) : 0;

            if (used + amount > quota) {
                return {
                    allowed: false,
                    remaining: Math.max(0, quota - used),
                    quota,
                };
            }

            // Increment usage
            await this.redis.incrby(usageKey, amount);
            await this.redis.expire(usageKey, this.getQuotaExpiry(quotaType));

            return {
                allowed: true,
                remaining: quota - used - amount,
                quota,
            };
        } catch (error) {
            this.logger.error(`Quota check failed: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getUsageMetrics(tenantId: string): Promise<UsageMetrics> {
        try {
            const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
            if (!tenant) {
                throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
            }

            const plan = tenant.plan || 'free';
            const quotas = this.defaultQuotas[plan];

            const metrics: UsageMetrics = {
                seedsUsed: 0,
                serpCallsUsed: 0,
                exportsUsed: 0,
                apiCallsUsed: 0,
                dataTransferUsed: 0,
                activeProjects: 0,
                teamMembers: 0,
            };

            // Get daily usage
            const today = this.getCurrentPeriod('dailySeeds');
            metrics.seedsUsed = await this.getQuotaUsage(tenantId, 'dailySeeds', today);
            metrics.serpCallsUsed = await this.getQuotaUsage(tenantId, 'dailySerpCalls', today);
            metrics.exportsUsed = await this.getQuotaUsage(tenantId, 'dailyExports', today);
            metrics.apiCallsUsed = await this.getQuotaUsage(tenantId, 'dailyApiCalls', today);

            // Get monthly usage
            const thisMonth = this.getCurrentPeriod('monthlyDataTransfer');
            metrics.dataTransferUsed = await this.getQuotaUsage(tenantId, 'monthlyDataTransfer', thisMonth);

            // Get current counts
            metrics.activeProjects = await this.getActiveProjectsCount(tenantId);
            metrics.teamMembers = await this.getTeamMembersCount(tenantId);

            return metrics;
        } catch (error) {
            this.logger.error(`Failed to get usage metrics: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getQuotaLimits(tenantId: string): Promise<QuotaConfig> {
        const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
        if (!tenant) {
            throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
        }

        const plan = tenant.plan || 'free';
        return this.defaultQuotas[plan];
    }

    async resetQuota(tenantId: string, quotaType: keyof QuotaConfig): Promise<void> {
        const period = this.getCurrentPeriod(quotaType);
        const key = `quota:${tenantId}:${quotaType}:${period}`;
        await this.redis.del(key);
    }

    async getRateLimitInfo(userId: string, tenantId: string, endpoint: string): Promise<{
        current: number;
        limit: number;
        remaining: number;
        resetTime: number;
    }> {
        const config = this.getRateLimitConfig(endpoint);
        const key = `rate_limit:${tenantId}:${userId}:${endpoint}`;
        const now = Date.now();
        const windowStart = now - config.windowMs;

        const usage = await this.redis.zrangebyscore(key, windowStart, '+inf');
        const current = usage.length;
        const remaining = Math.max(0, config.maxRequests - current);
        const resetTime = now + config.windowMs;

        return {
            current,
            limit: config.maxRequests,
            remaining,
            resetTime,
        };
    }

    async getQuotaUsage(tenantId: string, quotaType: keyof QuotaConfig, period: string): Promise<number> {
        const key = `quota:${tenantId}:${quotaType}:${period}`;
        const usage = await this.redis.get(key);
        return usage ? parseInt(usage) : 0;
    }

    private getRateLimitConfig(endpoint: string): RateLimitConfig {
        // Define rate limits based on endpoint
        const configs: Record<string, RateLimitConfig> = {
            '/v1/seeds': { windowMs: 60000, maxRequests: 10 }, // 10 seeds per minute
            '/v1/serp': { windowMs: 60000, maxRequests: 30 }, // 30 SERP calls per minute
            '/v1/exports': { windowMs: 300000, maxRequests: 5 }, // 5 exports per 5 minutes
            '/v1/projects': { windowMs: 60000, maxRequests: 20 }, // 20 project operations per minute
            '/v1/auth': { windowMs: 300000, maxRequests: 5 }, // 5 auth attempts per 5 minutes
        };

        return configs[endpoint] || { windowMs: 60000, maxRequests: 100 }; // Default: 100 requests per minute
    }

    private getCurrentPeriod(quotaType: keyof QuotaConfig): string {
        const now = new Date();

        if (quotaType.includes('daily')) {
            return now.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (quotaType.includes('monthly')) {
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        }

        return now.toISOString().split('T')[0]; // Default to daily
    }

    private getQuotaExpiry(quotaType: keyof QuotaConfig): number {
        if (quotaType.includes('daily')) {
            return 86400; // 24 hours
        } else if (quotaType.includes('monthly')) {
            return 2592000; // 30 days
        }

        return 86400; // Default to 24 hours
    }

    private async getActiveProjectsCount(tenantId: string): Promise<number> {
        // This would typically query the database
        // For now, return a placeholder
        return 0;
    }

    private async getTeamMembersCount(tenantId: string): Promise<number> {
        // This would typically query the database
        // For now, return a placeholder
        return 0;
    }
}
