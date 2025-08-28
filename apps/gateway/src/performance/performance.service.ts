import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface CacheMetrics {
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
    avgResponseTime: number;
    memoryUsage: number;
    createdAt: Date;
}

export interface PerformanceMetrics {
    queryCount: number;
    avgQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
    createdAt: Date;
}

export interface OptimizationRecommendation {
    type: 'cache' | 'index' | 'query' | 'memory' | 'connection';
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impact: string;
    implementation: string;
    estimatedImprovement: number;
    createdAt: Date;
}

@Injectable()
export class PerformanceService {
    private readonly logger = new Logger(PerformanceService.name);

    private readonly cacheTtl = {
        keywordData: 3600, // 1 hour
        serpResults: 1800, // 30 minutes
        clusterData: 7200, // 2 hours
        userSessions: 1800, // 30 minutes
        apiResponses: 300,  // 5 minutes
    };

    private readonly thresholds = {
        slowQueryTime: 1.0, // seconds
        highMemoryUsage: 80.0, // percentage
        highCpuUsage: 70.0, // percentage
        lowCacheHitRate: 60.0, // percentage
    };

    private metrics = {
        cacheHits: 0,
        cacheMisses: 0,
        queryTimes: [] as number[],
        memoryUsage: [] as number[],
        cpuUsage: [] as number[],
    };

    constructor(
        @InjectRedis() private readonly redis: Redis,
    ) { }

    async cacheGet<T>(key: string, cacheType: string = 'apiResponses'): Promise<T | null> {
        try {
            const startTime = Date.now();

            // Generate cache key
            const cacheKey = `${cacheType}:${key}`;

            // Try to get from cache
            const cachedValue = await this.redis.get(cacheKey);

            if (cachedValue) {
                // Cache hit
                this.metrics.cacheHits++;
                const responseTime = Date.now() - startTime;
                await this.recordCacheMetrics('hit', responseTime);

                return JSON.parse(cachedValue);
            } else {
                // Cache miss
                this.metrics.cacheMisses++;
                const responseTime = Date.now() - startTime;
                await this.recordCacheMetrics('miss', responseTime);

                return null;
            }

        } catch (error) {
            this.logger.error(`Error in cacheGet: ${error.message}`);
            return null;
        }
    }

    async cacheSet<T>(key: string, value: T, cacheType: string = 'apiResponses', ttl?: number): Promise<boolean> {
        try {
            // Generate cache key
            const cacheKey = `${cacheType}:${key}`;

            // Serialize value
            const serializedValue = JSON.stringify(value);

            // Set TTL
            const cacheTtl = ttl || this.cacheTtl[cacheType as keyof typeof this.cacheTtl] || 300;

            // Store in cache
            await this.redis.setex(cacheKey, cacheTtl, serializedValue);

            return true;

        } catch (error) {
            this.logger.error(`Error in cacheSet: ${error.message}`);
            return false;
        }
    }

    async cacheInvalidate(pattern: string): Promise<number> {
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                const deleted = await this.redis.del(...keys);
                this.logger.log(`Invalidated ${deleted} cache entries matching pattern: ${pattern}`);
                return deleted;
            }
            return 0;

        } catch (error) {
            this.logger.error(`Error invalidating cache: ${error.message}`);
            return 0;
        }
    }

    async cacheWarmup(dataSource: string, keys: string[]): Promise<Record<string, boolean>> {
        try {
            const results: Record<string, boolean> = {};

            for (const key of keys) {
                // Simulate data retrieval (in production, this would fetch from database)
                const data = await this.fetchDataForCache(dataSource, key);
                if (data) {
                    const success = await this.cacheSet(key, data, dataSource);
                    results[key] = success;
                } else {
                    results[key] = false;
                }
            }

            const successCount = Object.values(results).filter(Boolean).length;
            this.logger.log(`Cache warmup completed: ${successCount}/${keys.length} successful`);
            return results;

        } catch (error) {
            this.logger.error(`Error in cache warmup: ${error.message}`);
            return {};
        }
    }

    async optimizeQueries(queryPatterns: Array<{
        type: string;
        avgTime: number;
        frequency: number;
        query: string;
    }>): Promise<OptimizationRecommendation[]> {
        try {
            const recommendations: OptimizationRecommendation[] = [];

            for (const pattern of queryPatterns) {
                const { type, avgTime, frequency, query } = pattern;

                // Analyze query performance
                if (avgTime > this.thresholds.slowQueryTime) {
                    const recommendation = this.analyzeSlowQuery(type, query, avgTime, frequency);
                    if (recommendation) {
                        recommendations.push(recommendation);
                    }
                }

                // Check for missing indexes
                const indexRecommendation = this.checkMissingIndexes(query);
                if (indexRecommendation) {
                    recommendations.push(indexRecommendation);
                }
            }

            // Sort by priority
            recommendations.sort((a, b) => this.priorityScore(b.priority) - this.priorityScore(a.priority));

            return recommendations;

        } catch (error) {
            this.logger.error(`Error optimizing queries: ${error.message}`);
            return [];
        }
    }

    async optimizeMemoryUsage(): Promise<OptimizationRecommendation[]> {
        try {
            const recommendations: OptimizationRecommendation[] = [];

            // Get current memory usage (simulated)
            const memoryUsage = this.getMemoryUsage();

            if (memoryUsage > this.thresholds.highMemoryUsage) {
                // High memory usage detected
                const recommendation: OptimizationRecommendation = {
                    type: 'memory',
                    priority: memoryUsage > 90 ? 'high' : 'medium',
                    description: `High memory usage detected: ${memoryUsage.toFixed(1)}%`,
                    impact: 'May cause performance degradation and potential crashes',
                    implementation: 'Implement memory cleanup, optimize data structures, consider pagination',
                    estimatedImprovement: 20.0,
                    createdAt: new Date(),
                };
                recommendations.push(recommendation);
            }

            // Check for memory leaks
            const leakRecommendation = this.detectMemoryLeaks();
            if (leakRecommendation) {
                recommendations.push(leakRecommendation);
            }

            // Optimize cache memory
            const cacheRecommendation = await this.optimizeCacheMemory();
            if (cacheRecommendation) {
                recommendations.push(cacheRecommendation);
            }

            return recommendations;

        } catch (error) {
            this.logger.error(`Error optimizing memory usage: ${error.message}`);
            return [];
        }
    }

    async optimizeConnections(connectionMetrics: {
        active: number;
        max: number;
        idle: number;
    }): Promise<OptimizationRecommendation[]> {
        try {
            const recommendations: OptimizationRecommendation[] = [];

            const { active, max, idle } = connectionMetrics;
            const connectionUsage = (active / max) * 100;

            if (connectionUsage > 80) {
                const recommendation: OptimizationRecommendation = {
                    type: 'connection',
                    priority: 'high',
                    description: `High connection usage: ${connectionUsage.toFixed(1)}% (${active}/${max})`,
                    impact: 'May cause connection timeouts and degraded performance',
                    implementation: 'Implement connection pooling, optimize query patterns, increase connection limits',
                    estimatedImprovement: 15.0,
                    createdAt: new Date(),
                };
                recommendations.push(recommendation);
            }

            // Check for connection leaks
            const leakRecommendation = this.detectConnectionLeaks(connectionMetrics);
            if (leakRecommendation) {
                recommendations.push(leakRecommendation);
            }

            return recommendations;

        } catch (error) {
            this.logger.error(`Error optimizing connections: ${error.message}`);
            return [];
        }
    }

    async getPerformanceMetrics(): Promise<PerformanceMetrics> {
        try {
            // Calculate cache hit rate
            const totalRequests = this.metrics.cacheHits + this.metrics.cacheMisses;
            const cacheHitRate = totalRequests > 0 ? (this.metrics.cacheHits / totalRequests) * 100 : 0;

            // Calculate average query time
            const avgQueryTime = this.metrics.queryTimes.length > 0
                ? this.metrics.queryTimes.reduce((a, b) => a + b, 0) / this.metrics.queryTimes.length
                : 0;

            // Get system metrics
            const memoryUsage = this.getMemoryUsage();
            const cpuUsage = this.getCpuUsage();

            // Count slow queries
            const slowQueries = this.metrics.queryTimes.filter(time => time > this.thresholds.slowQueryTime).length;

            const metrics: PerformanceMetrics = {
                queryCount: this.metrics.queryTimes.length,
                avgQueryTime,
                slowQueries,
                cacheHitRate,
                memoryUsage,
                cpuUsage,
                activeConnections: 0, // Would be fetched from database
                createdAt: new Date(),
            };

            return metrics;

        } catch (error) {
            this.logger.error(`Error getting performance metrics: ${error.message}`);
            return {
                queryCount: 0,
                avgQueryTime: 0,
                slowQueries: 0,
                cacheHitRate: 0,
                memoryUsage: 0,
                cpuUsage: 0,
                activeConnections: 0,
                createdAt: new Date(),
            };
        }
    }

    async generateOptimizationReport(): Promise<{
        timestamp: string;
        healthScore: number;
        metrics: {
            cacheHitRate: number;
            avgQueryTime: number;
            memoryUsage: number;
            cpuUsage: number;
            slowQueries: number;
        };
        recommendations: Array<{
            type: string;
            priority: string;
            description: string;
            impact: string;
            implementation: string;
            estimatedImprovement: number;
        }>;
        summary: {
            totalRecommendations: number;
            criticalIssues: number;
            highPriority: number;
            estimatedTotalImprovement: number;
        };
    }> {
        try {
            // Get current metrics
            const metrics = await this.getPerformanceMetrics();

            // Generate recommendations
            const queryRecommendations = await this.optimizeQueries([]); // Would use actual query patterns
            const memoryRecommendations = await this.optimizeMemoryUsage();
            const connectionRecommendations = await this.optimizeConnections({ active: 0, max: 100, idle: 0 });

            // Combine all recommendations
            const allRecommendations = [
                ...queryRecommendations,
                ...memoryRecommendations,
                ...connectionRecommendations,
            ];

            // Calculate overall health score
            const healthScore = this.calculateHealthScore(metrics);

            const report = {
                timestamp: new Date().toISOString(),
                healthScore,
                metrics: {
                    cacheHitRate: metrics.cacheHitRate,
                    avgQueryTime: metrics.avgQueryTime,
                    memoryUsage: metrics.memoryUsage,
                    cpuUsage: metrics.cpuUsage,
                    slowQueries: metrics.slowQueries,
                },
                recommendations: allRecommendations.map(rec => ({
                    type: rec.type,
                    priority: rec.priority,
                    description: rec.description,
                    impact: rec.impact,
                    implementation: rec.implementation,
                    estimatedImprovement: rec.estimatedImprovement,
                })),
                summary: {
                    totalRecommendations: allRecommendations.length,
                    criticalIssues: allRecommendations.filter(r => r.priority === 'critical').length,
                    highPriority: allRecommendations.filter(r => r.priority === 'high').length,
                    estimatedTotalImprovement: allRecommendations.reduce((sum, r) => sum + r.estimatedImprovement, 0),
                },
            };

            return report;

        } catch (error) {
            this.logger.error(`Error generating optimization report: ${error.message}`);
            return { error: error.message } as any;
        }
    }

    async applyOptimizations(recommendations: OptimizationRecommendation[]): Promise<Record<string, boolean>> {
        try {
            const results: Record<string, boolean> = {};

            for (const recommendation of recommendations) {
                try {
                    let success = false;

                    switch (recommendation.type) {
                        case 'cache':
                            success = await this.applyCacheOptimization(recommendation);
                            break;
                        case 'index':
                            success = await this.applyIndexOptimization(recommendation);
                            break;
                        case 'query':
                            success = await this.applyQueryOptimization(recommendation);
                            break;
                        case 'memory':
                            success = await this.applyMemoryOptimization(recommendation);
                            break;
                        case 'connection':
                            success = await this.applyConnectionOptimization(recommendation);
                            break;
                    }

                    results[recommendation.description] = success;

                } catch (error) {
                    this.logger.error(`Error applying optimization ${recommendation.description}: ${error.message}`);
                    results[recommendation.description] = false;
                }
            }

            return results;

        } catch (error) {
            this.logger.error(`Error applying optimizations: ${error.message}`);
            return {};
        }
    }

    @Cron(CronExpression.EVERY_HOUR)
    async recordPerformanceMetrics() {
        try {
            const metrics = await this.getPerformanceMetrics();

            // Store metrics in Redis for historical analysis
            const metricKey = `performance_metrics:${new Date().toISOString().split('T')[0]}`;
            await this.redis.hset(metricKey, new Date().toISOString(), JSON.stringify(metrics));
            await this.redis.expire(metricKey, 86400 * 30); // 30 days

            this.logger.log('Performance metrics recorded');

        } catch (error) {
            this.logger.error(`Error recording performance metrics: ${error.message}`);
        }
    }

    private async recordCacheMetrics(hitOrMiss: string, responseTime: number): Promise<void> {
        try {
            // Store metrics in Redis for aggregation
            const metricKey = `cache_metrics:${new Date().toISOString().split('T')[0]}:${new Date().getHours()}`;

            const currentMetrics = await this.redis.hgetall(metricKey);
            const hits = parseInt(currentMetrics.hits || '0');
            const misses = parseInt(currentMetrics.misses || '0');
            const totalTime = parseFloat(currentMetrics.totalTime || '0');
            const count = parseInt(currentMetrics.count || '0');

            // Update metrics
            const newHits = hitOrMiss === 'hit' ? hits + 1 : hits;
            const newMisses = hitOrMiss === 'miss' ? misses + 1 : misses;
            const newTotalTime = totalTime + responseTime;
            const newCount = count + 1;

            // Store updated metrics
            await this.redis.hmset(metricKey, {
                hits: newHits.toString(),
                misses: newMisses.toString(),
                totalTime: newTotalTime.toString(),
                count: newCount.toString(),
            });
            await this.redis.expire(metricKey, 86400); // 24 hours

        } catch (error) {
            this.logger.error(`Error recording cache metrics: ${error.message}`);
        }
    }

    private async fetchDataForCache(dataSource: string, key: string): Promise<any> {
        try {
            // This would typically fetch from database or external API
            // For now, return mock data
            return {
                key,
                source: dataSource,
                data: `Mock data for ${key}`,
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            this.logger.error(`Error fetching data for cache: ${error.message}`);
            return null;
        }
    }

    private analyzeSlowQuery(type: string, query: string, avgTime: number, frequency: number): OptimizationRecommendation | null {
        try {
            // Simple analysis based on query characteristics
            if (query.toUpperCase().includes('SELECT *')) {
                return {
                    type: 'query',
                    priority: avgTime > 2.0 ? 'high' : 'medium',
                    description: `Slow ${type} query using SELECT *`,
                    impact: 'Unnecessary data retrieval causing performance degradation',
                    implementation: 'Replace SELECT * with specific column names, add WHERE clauses',
                    estimatedImprovement: 30.0,
                    createdAt: new Date(),
                };
            }

            if (query.toUpperCase().includes('ORDER BY') && !query.toUpperCase().includes('LIMIT')) {
                return {
                    type: 'query',
                    priority: 'medium',
                    description: `Unoptimized ${type} query with ORDER BY but no LIMIT`,
                    impact: 'Sorting entire result set unnecessarily',
                    implementation: 'Add LIMIT clause, consider pagination',
                    estimatedImprovement: 20.0,
                    createdAt: new Date(),
                };
            }

            return null;

        } catch (error) {
            this.logger.error(`Error analyzing slow query: ${error.message}`);
            return null;
        }
    }

    private checkMissingIndexes(query: string): OptimizationRecommendation | null {
        try {
            // Simple index analysis (in production, use database-specific tools)
            if (query.toUpperCase().includes('WHERE') && query.toUpperCase().includes('JOIN')) {
                return {
                    type: 'index',
                    priority: 'medium',
                    description: 'Potential missing indexes on JOIN conditions',
                    impact: 'Full table scans on joined tables',
                    implementation: 'Add indexes on JOIN columns, analyze query execution plan',
                    estimatedImprovement: 25.0,
                    createdAt: new Date(),
                };
            }

            return null;

        } catch (error) {
            this.logger.error(`Error checking missing indexes: ${error.message}`);
            return null;
        }
    }

    private detectMemoryLeaks(): OptimizationRecommendation | null {
        try {
            // Simple memory leak detection (in production, use specialized tools)
            if (this.metrics.memoryUsage.length > 10) {
                const recentUsage = this.metrics.memoryUsage.slice(-10);
                const isIncreasing = recentUsage.every((usage, i) => i === 0 || usage > recentUsage[i - 1]);

                if (isIncreasing) {
                    return {
                        type: 'memory',
                        priority: 'high',
                        description: 'Potential memory leak detected',
                        impact: 'Gradually increasing memory usage may lead to crashes',
                        implementation: 'Implement memory profiling, fix object references, add garbage collection',
                        estimatedImprovement: 40.0,
                        createdAt: new Date(),
                    };
                }
            }

            return null;

        } catch (error) {
            this.logger.error(`Error detecting memory leaks: ${error.message}`);
            return null;
        }
    }

    private async optimizeCacheMemory(): Promise<OptimizationRecommendation | null> {
        try {
            // Check cache memory usage
            const cacheInfo = await this.redis.info('memory');
            const usedMemory = parseInt(cacheInfo.match(/used_memory:(\d+)/)?.[1] || '0');
            const maxMemory = parseInt(cacheInfo.match(/maxmemory:(\d+)/)?.[1] || '0');

            if (maxMemory > 0) {
                const memoryUsagePercent = (usedMemory / maxMemory) * 100;

                if (memoryUsagePercent > 80) {
                    return {
                        type: 'cache',
                        priority: 'medium',
                        description: `High cache memory usage: ${memoryUsagePercent.toFixed(1)}%`,
                        impact: 'Cache evictions may reduce hit rate',
                        implementation: 'Adjust cache TTL, implement cache eviction policies, increase memory',
                        estimatedImprovement: 15.0,
                        createdAt: new Date(),
                    };
                }
            }

            return null;

        } catch (error) {
            this.logger.error(`Error optimizing cache memory: ${error.message}`);
            return null;
        }
    }

    private detectConnectionLeaks(connectionMetrics: { active: number; max: number; idle: number }): OptimizationRecommendation | null {
        try {
            const { active, idle } = connectionMetrics;

            if (active > 0 && idle > active * 2) {
                return {
                    type: 'connection',
                    priority: 'medium',
                    description: 'Potential connection leak detected',
                    impact: 'Unused connections consuming resources',
                    implementation: 'Implement connection pooling, add connection timeouts, monitor connection lifecycle',
                    estimatedImprovement: 20.0,
                    createdAt: new Date(),
                };
            }

            return null;

        } catch (error) {
            this.logger.error(`Error detecting connection leaks: ${error.message}`);
            return null;
        }
    }

    private calculateHealthScore(metrics: PerformanceMetrics): number {
        try {
            let score = 100.0;

            // Deduct points for performance issues
            if (metrics.cacheHitRate < this.thresholds.lowCacheHitRate) {
                score -= (this.thresholds.lowCacheHitRate - metrics.cacheHitRate) * 0.5;
            }

            if (metrics.avgQueryTime > this.thresholds.slowQueryTime) {
                score -= (metrics.avgQueryTime - this.thresholds.slowQueryTime) * 10;
            }

            if (metrics.memoryUsage > this.thresholds.highMemoryUsage) {
                score -= (metrics.memoryUsage - this.thresholds.highMemoryUsage) * 0.5;
            }

            if (metrics.cpuUsage > this.thresholds.highCpuUsage) {
                score -= (metrics.cpuUsage - this.thresholds.highCpuUsage) * 0.5;
            }

            return Math.max(0.0, Math.min(100.0, score));

        } catch (error) {
            this.logger.error(`Error calculating health score: ${error.message}`);
            return 50.0;
        }
    }

    private priorityScore(priority: string): number {
        const priorityScores = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1,
        };
        return priorityScores[priority as keyof typeof priorityScores] || 0;
    }

    private getMemoryUsage(): number {
        // Simulated memory usage (in production, use process.memoryUsage())
        return Math.random() * 100;
    }

    private getCpuUsage(): number {
        // Simulated CPU usage (in production, use system monitoring)
        return Math.random() * 100;
    }

    private async applyCacheOptimization(recommendation: OptimizationRecommendation): Promise<boolean> {
        try {
            // Implement cache optimization logic
            this.logger.log(`Applying cache optimization: ${recommendation.description}`);
            return true;

        } catch (error) {
            this.logger.error(`Error applying cache optimization: ${error.message}`);
            return false;
        }
    }

    private async applyIndexOptimization(recommendation: OptimizationRecommendation): Promise<boolean> {
        try {
            // Implement index optimization logic
            this.logger.log(`Applying index optimization: ${recommendation.description}`);
            return true;

        } catch (error) {
            this.logger.error(`Error applying index optimization: ${error.message}`);
            return false;
        }
    }

    private async applyQueryOptimization(recommendation: OptimizationRecommendation): Promise<boolean> {
        try {
            // Implement query optimization logic
            this.logger.log(`Applying query optimization: ${recommendation.description}`);
            return true;

        } catch (error) {
            this.logger.error(`Error applying query optimization: ${error.message}`);
            return false;
        }
    }

    private async applyMemoryOptimization(recommendation: OptimizationRecommendation): Promise<boolean> {
        try {
            // Implement memory optimization logic
            this.logger.log(`Applying memory optimization: ${recommendation.description}`);

            // Force garbage collection
            if (global.gc) {
                global.gc();
            }

            return true;

        } catch (error) {
            this.logger.error(`Error applying memory optimization: ${error.message}`);
            return false;
        }
    }

    private async applyConnectionOptimization(recommendation: OptimizationRecommendation): Promise<boolean> {
        try {
            // Implement connection optimization logic
            this.logger.log(`Applying connection optimization: ${recommendation.description}`);
            return true;

        } catch (error) {
            this.logger.error(`Error applying connection optimization: ${error.message}`);
            return false;
        }
    }
}
