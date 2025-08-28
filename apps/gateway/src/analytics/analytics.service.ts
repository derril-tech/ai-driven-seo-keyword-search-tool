import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Project } from '../entities/project.entity';
import { Keyword } from '../entities/keyword.entity';
import { Cluster } from '../entities/cluster.entity';
import { Export } from '../entities/export.entity';
import { AuditLog } from '../entities/audit-log.entity';

export interface AnalyticsMetrics {
    totalProjects: number;
    totalKeywords: number;
    totalClusters: number;
    totalExports: number;
    averageKeywordsPerProject: number;
    averageClustersPerProject: number;
    completionRate: number;
    averageProcessingTime: number;
}

export interface TimeSeriesData {
    date: string;
    value: number;
    label?: string;
}

export interface ProjectAnalytics {
    projectId: string;
    projectName: string;
    keywordsCount: number;
    clustersCount: number;
    completionRate: number;
    processingTime: number;
    difficultyDistribution: Record<string, number>;
    intentDistribution: Record<string, number>;
    serpFeatures: Record<string, number>;
    topKeywords: Array<{
        keyword: string;
        searchVolume: number;
        difficulty: number;
        intent: string;
    }>;
}

export interface KeywordAnalytics {
    keyword: string;
    searchVolume: number;
    difficulty: number;
    intent: string;
    serpFeatures: string[];
    competitors: string[];
    trend: 'increasing' | 'decreasing' | 'stable';
    seasonality: boolean;
    opportunities: string[];
}

export interface ClusterAnalytics {
    clusterId: string;
    clusterName: string;
    keywordsCount: number;
    averageDifficulty: number;
    averageSearchVolume: number;
    intentDistribution: Record<string, number>;
    topKeywords: string[];
    contentGaps: string[];
    competitiveAnalysis: {
        topCompetitors: string[];
        marketShare: number;
        threatLevel: 'low' | 'medium' | 'high';
    };
}

export interface ExportAnalytics {
    totalExports: number;
    exportsByFormat: Record<string, number>;
    exportsByProject: Record<string, number>;
    averageExportSize: number;
    mostExportedData: string[];
    exportTrends: TimeSeriesData[];
}

export interface UserActivityAnalytics {
    totalUsers: number;
    activeUsers: number;
    userEngagement: {
        averageSessionDuration: number;
        averageProjectsPerUser: number;
        averageKeywordsPerUser: number;
    };
    userActivity: TimeSeriesData[];
    topUsers: Array<{
        userId: string;
        userName: string;
        projectsCount: number;
        keywordsCount: number;
        lastActivity: Date;
    }>;
}

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
        @InjectRepository(Keyword)
        private readonly keywordRepository: Repository<Keyword>,
        @InjectRepository(Cluster)
        private readonly clusterRepository: Repository<Cluster>,
        @InjectRepository(Export)
        private readonly exportRepository: Repository<Export>,
        @InjectRepository(AuditLog)
        private readonly auditLogRepository: Repository<AuditLog>,
        @InjectRedis() private readonly redis: Redis,
    ) { }

    async getOverallMetrics(tenantId: string, orgId?: string): Promise<AnalyticsMetrics> {
        try {
            const whereClause = orgId ? { tenant_id: tenantId, org_id: orgId } : { tenant_id: tenantId };

            const [totalProjects, totalKeywords, totalClusters, totalExports] = await Promise.all([
                this.projectRepository.count({ where: whereClause }),
                this.keywordRepository.count({ where: whereClause }),
                this.clusterRepository.count({ where: whereClause }),
                this.exportRepository.count({ where: whereClause }),
            ]);

            const averageKeywordsPerProject = totalProjects > 0 ? totalKeywords / totalProjects : 0;
            const averageClustersPerProject = totalProjects > 0 ? totalClusters / totalProjects : 0;

            // Calculate completion rate (projects with keywords and clusters)
            const completedProjects = await this.projectRepository
                .createQueryBuilder('project')
                .leftJoin('project.keywords', 'keyword')
                .leftJoin('project.clusters', 'cluster')
                .where('project.tenant_id = :tenantId', { tenantId })
                .andWhere(orgId ? 'project.org_id = :orgId' : '1=1', orgId ? { orgId } : {})
                .andWhere('keyword.id IS NOT NULL')
                .andWhere('cluster.id IS NOT NULL')
                .getCount();

            const completionRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

            // Calculate average processing time
            const processingTimes = await this.getProcessingTimes(tenantId, orgId);
            const averageProcessingTime = processingTimes.length > 0
                ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
                : 0;

            return {
                totalProjects,
                totalKeywords,
                totalClusters,
                totalExports,
                averageKeywordsPerProject,
                averageClustersPerProject,
                completionRate,
                averageProcessingTime,
            };
        } catch (error) {
            this.logger.error(`Failed to get overall metrics: ${error.message}`, error.stack);
            throw new HttpException('Failed to get analytics metrics', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getProjectAnalytics(
        tenantId: string,
        projectId: string,
        orgId?: string,
    ): Promise<ProjectAnalytics> {
        try {
            const project = await this.projectRepository.findOne({
                where: { id: projectId, tenant_id: tenantId, ...(orgId && { org_id: orgId }) },
                relations: ['keywords', 'clusters'],
            });

            if (!project) {
                throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
            }

            const keywords = project.keywords || [];
            const clusters = project.clusters || [];

            // Calculate difficulty distribution
            const difficultyDistribution = this.calculateDifficultyDistribution(keywords);

            // Calculate intent distribution
            const intentDistribution = this.calculateIntentDistribution(keywords);

            // Calculate SERP features
            const serpFeatures = this.calculateSerpFeatures(keywords);

            // Get top keywords
            const topKeywords = this.getTopKeywords(keywords, 10);

            // Calculate completion rate
            const completionRate = keywords.length > 0 && clusters.length > 0 ? 100 : 0;

            // Calculate processing time
            const processingTime = this.calculateProcessingTime(project);

            return {
                projectId: project.id,
                projectName: project.name,
                keywordsCount: keywords.length,
                clustersCount: clusters.length,
                completionRate,
                processingTime,
                difficultyDistribution,
                intentDistribution,
                serpFeatures,
                topKeywords,
            };
        } catch (error) {
            this.logger.error(`Failed to get project analytics: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getKeywordAnalytics(
        tenantId: string,
        keywordId: string,
        orgId?: string,
    ): Promise<KeywordAnalytics> {
        try {
            const keyword = await this.keywordRepository.findOne({
                where: { id: keywordId, tenant_id: tenantId, ...(orgId && { org_id: orgId }) },
            });

            if (!keyword) {
                throw new HttpException('Keyword not found', HttpStatus.NOT_FOUND);
            }

            // Analyze trend (mock data for now)
            const trend = this.analyzeKeywordTrend(keyword);

            // Check for seasonality
            const seasonality = this.checkSeasonality(keyword);

            // Identify opportunities
            const opportunities = this.identifyOpportunities(keyword);

            return {
                keyword: keyword.keyword,
                searchVolume: keyword.search_volume || 0,
                difficulty: keyword.difficulty || 0,
                intent: keyword.intent || 'unknown',
                serpFeatures: keyword.serp_features || [],
                competitors: keyword.competitors || [],
                trend,
                seasonality,
                opportunities,
            };
        } catch (error) {
            this.logger.error(`Failed to get keyword analytics: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getClusterAnalytics(
        tenantId: string,
        clusterId: string,
        orgId?: string,
    ): Promise<ClusterAnalytics> {
        try {
            const cluster = await this.clusterRepository.findOne({
                where: { id: clusterId, tenant_id: tenantId, ...(orgId && { org_id: orgId }) },
                relations: ['keywords'],
            });

            if (!cluster) {
                throw new HttpException('Cluster not found', HttpStatus.NOT_FOUND);
            }

            const keywords = cluster.keywords || [];

            // Calculate metrics
            const averageDifficulty = keywords.length > 0
                ? keywords.reduce((sum, k) => sum + (k.difficulty || 0), 0) / keywords.length
                : 0;

            const averageSearchVolume = keywords.length > 0
                ? keywords.reduce((sum, k) => sum + (k.search_volume || 0), 0) / keywords.length
                : 0;

            const intentDistribution = this.calculateIntentDistribution(keywords);

            const topKeywords = keywords
                .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
                .slice(0, 5)
                .map(k => k.keyword);

            const contentGaps = this.identifyContentGaps(keywords);

            const competitiveAnalysis = this.analyzeCompetition(keywords);

            return {
                clusterId: cluster.id,
                clusterName: cluster.name,
                keywordsCount: keywords.length,
                averageDifficulty,
                averageSearchVolume,
                intentDistribution,
                topKeywords,
                contentGaps,
                competitiveAnalysis,
            };
        } catch (error) {
            this.logger.error(`Failed to get cluster analytics: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getExportAnalytics(tenantId: string, orgId?: string): Promise<ExportAnalytics> {
        try {
            const whereClause = orgId ? { tenant_id: tenantId, org_id: orgId } : { tenant_id: tenantId };

            const exports = await this.exportRepository.find({ where: whereClause });

            const exportsByFormat = exports.reduce((acc, exp) => {
                acc[exp.format] = (acc[exp.format] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const exportsByProject = exports.reduce((acc, exp) => {
                acc[exp.project_id] = (acc[exp.project_id] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const averageExportSize = exports.length > 0
                ? exports.reduce((sum, exp) => sum + (exp.size || 0), 0) / exports.length
                : 0;

            const mostExportedData = this.getMostExportedData(exports);

            const exportTrends = this.calculateExportTrends(exports);

            return {
                totalExports: exports.length,
                exportsByFormat,
                exportsByProject,
                averageExportSize,
                mostExportedData,
                exportTrends,
            };
        } catch (error) {
            this.logger.error(`Failed to get export analytics: ${error.message}`, error.stack);
            throw new HttpException('Failed to get export analytics', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getUserActivityAnalytics(tenantId: string, orgId?: string): Promise<UserActivityAnalytics> {
        try {
            // Get user activity from audit logs
            const whereClause = orgId ? { tenant_id: tenantId, org_id: orgId } : { tenant_id: tenantId };

            const userActivities = await this.auditLogRepository.find({
                where: whereClause,
                order: { created_at: 'DESC' },
            });

            const uniqueUsers = new Set(userActivities.map(activity => activity.user_id));
            const totalUsers = uniqueUsers.size;

            // Calculate active users (users with activity in last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const activeUsers = new Set(
                userActivities
                    .filter(activity => new Date(activity.created_at) > thirtyDaysAgo)
                    .map(activity => activity.user_id)
            ).size;

            // Calculate user engagement
            const userEngagement = this.calculateUserEngagement(userActivities);

            // Get user activity trends
            const userActivity = this.calculateUserActivityTrends(userActivities);

            // Get top users
            const topUsers = this.getTopUsers(userActivities);

            return {
                totalUsers,
                activeUsers,
                userEngagement,
                userActivity,
                topUsers,
            };
        } catch (error) {
            this.logger.error(`Failed to get user activity analytics: ${error.message}`, error.stack);
            throw new HttpException('Failed to get user activity analytics', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async generateAnalyticsReport(
        tenantId: string,
        orgId?: string,
        reportType: 'overview' | 'detailed' | 'executive' = 'overview',
    ): Promise<{
        generatedAt: string;
        metrics: AnalyticsMetrics;
        projectAnalytics?: ProjectAnalytics[];
        exportAnalytics?: ExportAnalytics;
        userActivity?: UserActivityAnalytics;
        insights: string[];
        recommendations: string[];
    }> {
        try {
            const metrics = await this.getOverallMetrics(tenantId, orgId);
            const insights = this.generateInsights(metrics);
            const recommendations = this.generateRecommendations(metrics);

            const report: any = {
                generatedAt: new Date().toISOString(),
                metrics,
                insights,
                recommendations,
            };

            if (reportType === 'detailed' || reportType === 'executive') {
                // Get project analytics for top projects
                const projects = await this.projectRepository.find({
                    where: orgId ? { tenant_id: tenantId, org_id: orgId } : { tenant_id: tenantId },
                    order: { created_at: 'DESC' },
                    take: 10,
                });

                const projectAnalytics = await Promise.all(
                    projects.map(project => this.getProjectAnalytics(tenantId, project.id, orgId))
                );

                report.projectAnalytics = projectAnalytics;
                report.exportAnalytics = await this.getExportAnalytics(tenantId, orgId);
            }

            if (reportType === 'executive') {
                report.userActivity = await this.getUserActivityAnalytics(tenantId, orgId);
            }

            return report;
        } catch (error) {
            this.logger.error(`Failed to generate analytics report: ${error.message}`, error.stack);
            throw new HttpException('Failed to generate analytics report', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // Helper methods
    private async getProcessingTimes(tenantId: string, orgId?: string): Promise<number[]> {
        // Mock implementation - would calculate actual processing times
        return [120, 180, 90, 150, 200];
    }

    private calculateDifficultyDistribution(keywords: any[]): Record<string, number> {
        const distribution = { easy: 0, medium: 0, hard: 0 };

        keywords.forEach(keyword => {
            const difficulty = keyword.difficulty || 0;
            if (difficulty < 30) distribution.easy++;
            else if (difficulty < 70) distribution.medium++;
            else distribution.hard++;
        });

        return distribution;
    }

    private calculateIntentDistribution(keywords: any[]): Record<string, number> {
        const distribution: Record<string, number> = {};

        keywords.forEach(keyword => {
            const intent = keyword.intent || 'unknown';
            distribution[intent] = (distribution[intent] || 0) + 1;
        });

        return distribution;
    }

    private calculateSerpFeatures(keywords: any[]): Record<string, number> {
        const features: Record<string, number> = {};

        keywords.forEach(keyword => {
            const serpFeatures = keyword.serp_features || [];
            serpFeatures.forEach((feature: string) => {
                features[feature] = (features[feature] || 0) + 1;
            });
        });

        return features;
    }

    private getTopKeywords(keywords: any[], limit: number): Array<{
        keyword: string;
        searchVolume: number;
        difficulty: number;
        intent: string;
    }> {
        return keywords
            .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
            .slice(0, limit)
            .map(k => ({
                keyword: k.keyword,
                searchVolume: k.search_volume || 0,
                difficulty: k.difficulty || 0,
                intent: k.intent || 'unknown',
            }));
    }

    private calculateProcessingTime(project: any): number {
        // Mock implementation - would calculate actual processing time
        return Math.random() * 300 + 60; // 1-6 minutes
    }

    private analyzeKeywordTrend(keyword: any): 'increasing' | 'decreasing' | 'stable' {
        // Mock implementation - would analyze actual trend data
        const trends: Array<'increasing' | 'decreasing' | 'stable'> = ['increasing', 'decreasing', 'stable'];
        return trends[Math.floor(Math.random() * trends.length)];
    }

    private checkSeasonality(keyword: any): boolean {
        // Mock implementation - would check actual seasonality data
        return Math.random() > 0.5;
    }

    private identifyOpportunities(keyword: any): string[] {
        // Mock implementation - would identify actual opportunities
        return ['Featured snippet opportunity', 'Long-tail keyword expansion', 'Competitor gap'];
    }

    private identifyContentGaps(keywords: any[]): string[] {
        // Mock implementation - would identify actual content gaps
        return ['Missing FAQ content', 'No video content', 'Limited local SEO'];
    }

    private analyzeCompetition(keywords: any[]): {
        topCompetitors: string[];
        marketShare: number;
        threatLevel: 'low' | 'medium' | 'high';
    } {
        // Mock implementation - would analyze actual competition data
        return {
            topCompetitors: ['competitor1.com', 'competitor2.com', 'competitor3.com'],
            marketShare: Math.random() * 100,
            threatLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
        };
    }

    private getMostExportedData(exports: any[]): string[] {
        // Mock implementation - would analyze actual export data
        return ['Keywords with SERP data', 'Clustered keywords', 'Content briefs'];
    }

    private calculateExportTrends(exports: any[]): TimeSeriesData[] {
        // Mock implementation - would calculate actual export trends
        const trends: TimeSeriesData[] = [];
        const now = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            trends.push({
                date: date.toISOString().split('T')[0],
                value: Math.floor(Math.random() * 20) + 1,
            });
        }

        return trends;
    }

    private calculateUserEngagement(userActivities: any[]): {
        averageSessionDuration: number;
        averageProjectsPerUser: number;
        averageKeywordsPerUser: number;
    } {
        // Mock implementation - would calculate actual user engagement
        return {
            averageSessionDuration: Math.random() * 1800 + 300, // 5-35 minutes
            averageProjectsPerUser: Math.random() * 5 + 1,
            averageKeywordsPerUser: Math.random() * 100 + 10,
        };
    }

    private calculateUserActivityTrends(userActivities: any[]): TimeSeriesData[] {
        // Mock implementation - would calculate actual user activity trends
        const trends: TimeSeriesData[] = [];
        const now = new Date();

        for (let i = 29; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            trends.push({
                date: date.toISOString().split('T')[0],
                value: Math.floor(Math.random() * 50) + 5,
            });
        }

        return trends;
    }

    private getTopUsers(userActivities: any[]): Array<{
        userId: string;
        userName: string;
        projectsCount: number;
        keywordsCount: number;
        lastActivity: Date;
    }> {
        // Mock implementation - would get actual top users
        return [
            {
                userId: 'user1',
                userName: 'John Doe',
                projectsCount: 15,
                keywordsCount: 500,
                lastActivity: new Date(),
            },
            {
                userId: 'user2',
                userName: 'Jane Smith',
                projectsCount: 12,
                keywordsCount: 400,
                lastActivity: new Date(),
            },
        ];
    }

    private generateInsights(metrics: AnalyticsMetrics): string[] {
        const insights: string[] = [];

        if (metrics.completionRate < 50) {
            insights.push('Low project completion rate suggests users may need better onboarding');
        }

        if (metrics.averageKeywordsPerProject < 50) {
            insights.push('Projects have relatively few keywords, consider expanding seed topics');
        }

        if (metrics.averageProcessingTime > 300) {
            insights.push('High processing times may indicate performance optimization opportunities');
        }

        return insights;
    }

    private generateRecommendations(metrics: AnalyticsMetrics): string[] {
        const recommendations: string[] = [];

        if (metrics.completionRate < 50) {
            recommendations.push('Implement guided project setup workflow');
            recommendations.push('Add project templates for common use cases');
        }

        if (metrics.averageKeywordsPerProject < 50) {
            recommendations.push('Provide keyword expansion suggestions');
            recommendations.push('Offer bulk seed import functionality');
        }

        if (metrics.averageProcessingTime > 300) {
            recommendations.push('Optimize keyword expansion algorithms');
            recommendations.push('Implement background job processing');
        }

        return recommendations;
    }
}
