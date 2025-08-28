import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService, AnalyticsMetrics, ProjectAnalytics, KeywordAnalytics, ClusterAnalytics, ExportAnalytics, UserActivityAnalytics } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('analytics')
@Controller('v1/analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('metrics')
    @ApiOperation({ summary: 'Get overall analytics metrics' })
    @ApiResponse({ status: 200, description: 'Analytics metrics retrieved successfully' })
    async getOverallMetrics(
        @Query('tenantId') tenantId: string,
        @Query('orgId') orgId?: string,
    ): Promise<AnalyticsMetrics> {
        return this.analyticsService.getOverallMetrics(tenantId, orgId);
    }

    @Get('projects/:projectId')
    @ApiOperation({ summary: 'Get project-specific analytics' })
    @ApiResponse({ status: 200, description: 'Project analytics retrieved successfully' })
    async getProjectAnalytics(
        @Param('projectId') projectId: string,
        @Query('tenantId') tenantId: string,
        @Query('orgId') orgId?: string,
    ): Promise<ProjectAnalytics> {
        return this.analyticsService.getProjectAnalytics(tenantId, projectId, orgId);
    }

    @Get('keywords/:keywordId')
    @ApiOperation({ summary: 'Get keyword-specific analytics' })
    @ApiResponse({ status: 200, description: 'Keyword analytics retrieved successfully' })
    async getKeywordAnalytics(
        @Param('keywordId') keywordId: string,
        @Query('tenantId') tenantId: string,
        @Query('orgId') orgId?: string,
    ): Promise<KeywordAnalytics> {
        return this.analyticsService.getKeywordAnalytics(tenantId, keywordId, orgId);
    }

    @Get('clusters/:clusterId')
    @ApiOperation({ summary: 'Get cluster-specific analytics' })
    @ApiResponse({ status: 200, description: 'Cluster analytics retrieved successfully' })
    async getClusterAnalytics(
        @Param('clusterId') clusterId: string,
        @Query('tenantId') tenantId: string,
        @Query('orgId') orgId?: string,
    ): Promise<ClusterAnalytics> {
        return this.analyticsService.getClusterAnalytics(tenantId, clusterId, orgId);
    }

    @Get('exports')
    @ApiOperation({ summary: 'Get export analytics' })
    @ApiResponse({ status: 200, description: 'Export analytics retrieved successfully' })
    async getExportAnalytics(
        @Query('tenantId') tenantId: string,
        @Query('orgId') orgId?: string,
    ): Promise<ExportAnalytics> {
        return this.analyticsService.getExportAnalytics(tenantId, orgId);
    }

    @Get('user-activity')
    @ApiOperation({ summary: 'Get user activity analytics' })
    @ApiResponse({ status: 200, description: 'User activity analytics retrieved successfully' })
    async getUserActivityAnalytics(
        @Query('tenantId') tenantId: string,
        @Query('orgId') orgId?: string,
    ): Promise<UserActivityAnalytics> {
        return this.analyticsService.getUserActivityAnalytics(tenantId, orgId);
    }

    @Post('reports')
    @ApiOperation({ summary: 'Generate analytics report' })
    @ApiResponse({ status: 200, description: 'Analytics report generated successfully' })
    async generateAnalyticsReport(
        @Body() body: {
            tenantId: string;
            orgId?: string;
            reportType: 'overview' | 'detailed' | 'executive';
        },
    ): Promise<{
        generatedAt: string;
        metrics: AnalyticsMetrics;
        projectAnalytics?: ProjectAnalytics[];
        exportAnalytics?: ExportAnalytics;
        userActivity?: UserActivityAnalytics;
        insights: string[];
        recommendations: string[];
    }> {
        return this.analyticsService.generateAnalyticsReport(
            body.tenantId,
            body.orgId,
            body.reportType,
        );
    }

    @Get('dashboard')
    @ApiOperation({ summary: 'Get dashboard analytics summary' })
    @ApiResponse({ status: 200, description: 'Dashboard analytics retrieved successfully' })
    async getDashboardAnalytics(
        @Query('tenantId') tenantId: string,
        @Query('orgId') orgId?: string,
    ): Promise<{
        metrics: AnalyticsMetrics;
        recentActivity: any[];
        topProjects: any[];
        quickInsights: string[];
    }> {
        const metrics = await this.analyticsService.getOverallMetrics(tenantId, orgId);

        // Mock data for dashboard
        const recentActivity = [
            { type: 'project_created', project: 'E-commerce SEO', user: 'John Doe', time: new Date() },
            { type: 'export_completed', project: 'Blog Keywords', user: 'Jane Smith', time: new Date() },
            { type: 'cluster_generated', project: 'Local SEO', user: 'Mike Johnson', time: new Date() },
        ];

        const topProjects = [
            { name: 'E-commerce SEO', keywords: 1500, clusters: 25, completion: 95 },
            { name: 'Blog Keywords', keywords: 800, clusters: 15, completion: 88 },
            { name: 'Local SEO', keywords: 600, clusters: 12, completion: 92 },
        ];

        const quickInsights = [
            'Project completion rate is above average',
            'Most users are focusing on e-commerce keywords',
            'Export usage has increased by 15% this month',
        ];

        return {
            metrics,
            recentActivity,
            topProjects,
            quickInsights,
        };
    }
}
