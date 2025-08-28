import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PerformanceService, PerformanceMetrics, OptimizationRecommendation } from './performance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('performance')
@Controller('v1/performance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PerformanceController {
    constructor(private readonly performanceService: PerformanceService) { }

    @Get('metrics')
    @ApiOperation({ summary: 'Get current performance metrics' })
    @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
    async getMetrics(): Promise<PerformanceMetrics> {
        return this.performanceService.getPerformanceMetrics();
    }

    @Get('optimization-report')
    @ApiOperation({ summary: 'Generate comprehensive optimization report' })
    @ApiResponse({ status: 200, description: 'Optimization report generated successfully' })
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
        return this.performanceService.generateOptimizationReport();
    }

    @Post('cache/invalidate')
    @ApiOperation({ summary: 'Invalidate cache entries matching pattern' })
    @ApiResponse({ status: 200, description: 'Cache invalidated successfully' })
    async invalidateCache(@Body() body: { pattern: string }): Promise<{ deleted: number }> {
        const deleted = await this.performanceService.cacheInvalidate(body.pattern);
        return { deleted };
    }

    @Post('cache/warmup')
    @ApiOperation({ summary: 'Warm up cache with frequently accessed data' })
    @ApiResponse({ status: 200, description: 'Cache warmup completed' })
    async warmupCache(@Body() body: { dataSource: string; keys: string[] }): Promise<Record<string, boolean>> {
        return this.performanceService.cacheWarmup(body.dataSource, body.keys);
    }

    @Post('optimize/queries')
    @ApiOperation({ summary: 'Analyze and optimize database queries' })
    @ApiResponse({ status: 200, description: 'Query optimization completed' })
    async optimizeQueries(@Body() body: {
        queryPatterns: Array<{
            type: string;
            avgTime: number;
            frequency: number;
            query: string;
        }>;
    }): Promise<OptimizationRecommendation[]> {
        return this.performanceService.optimizeQueries(body.queryPatterns);
    }

    @Post('optimize/memory')
    @ApiOperation({ summary: 'Analyze and optimize memory usage' })
    @ApiResponse({ status: 200, description: 'Memory optimization completed' })
    async optimizeMemory(): Promise<OptimizationRecommendation[]> {
        return this.performanceService.optimizeMemoryUsage();
    }

    @Post('optimize/connections')
    @ApiOperation({ summary: 'Analyze and optimize database connections' })
    @ApiResponse({ status: 200, description: 'Connection optimization completed' })
    async optimizeConnections(@Body() body: {
        connectionMetrics: {
            active: number;
            max: number;
            idle: number;
        };
    }): Promise<OptimizationRecommendation[]> {
        return this.performanceService.optimizeConnections(body.connectionMetrics);
    }

    @Post('apply-optimizations')
    @ApiOperation({ summary: 'Apply optimization recommendations' })
    @ApiResponse({ status: 200, description: 'Optimizations applied successfully' })
    async applyOptimizations(@Body() body: {
        recommendations: OptimizationRecommendation[];
    }): Promise<Record<string, boolean>> {
        return this.performanceService.applyOptimizations(body.recommendations);
    }

    @Get('cache/stats')
    @ApiOperation({ summary: 'Get cache statistics' })
    @ApiResponse({ status: 200, description: 'Cache statistics retrieved successfully' })
    async getCacheStats(): Promise<{
        hits: number;
        misses: number;
        hitRate: number;
        totalRequests: number;
    }> {
        const metrics = await this.performanceService.getPerformanceMetrics();
        return {
            hits: metrics.queryCount, // This would be actual cache hits in production
            misses: metrics.slowQueries, // This would be actual cache misses in production
            hitRate: metrics.cacheHitRate,
            totalRequests: metrics.queryCount + metrics.slowQueries,
        };
    }

    @Get('health')
    @ApiOperation({ summary: 'Get system health status' })
    @ApiResponse({ status: 200, description: 'Health status retrieved successfully' })
    async getHealthStatus(): Promise<{
        status: 'healthy' | 'warning' | 'critical';
        score: number;
        issues: string[];
        recommendations: string[];
    }> {
        const metrics = await this.performanceService.getPerformanceMetrics();
        const report = await this.performanceService.generateOptimizationReport();

        const issues: string[] = [];
        const recommendations: string[] = [];

        // Check for critical issues
        if (metrics.memoryUsage > 90) {
            issues.push('Critical memory usage');
        }
        if (metrics.cpuUsage > 90) {
            issues.push('Critical CPU usage');
        }
        if (metrics.cacheHitRate < 30) {
            issues.push('Very low cache hit rate');
        }
        if (metrics.avgQueryTime > 5) {
            issues.push('Very slow query performance');
        }

        // Add recommendations
        report.recommendations.forEach(rec => {
            if (rec.priority === 'critical' || rec.priority === 'high') {
                recommendations.push(rec.description);
            }
        });

        // Determine status
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (issues.length > 0) {
            status = issues.some(issue => issue.includes('Critical')) ? 'critical' : 'warning';
        }

        return {
            status,
            score: report.healthScore,
            issues,
            recommendations: recommendations.slice(0, 5), // Limit to top 5
        };
    }
}
