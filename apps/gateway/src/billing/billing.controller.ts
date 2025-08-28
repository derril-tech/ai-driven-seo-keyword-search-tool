import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService, UsageMetrics, QuotaLimits, BillingPlan } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from '../auth/user.decorator';

@ApiTags('billing')
@Controller('v1/billing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

    @Get('usage')
    @ApiOperation({ summary: 'Get current usage metrics for organization' })
    @ApiResponse({ status: 200, description: 'Usage metrics retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getUsage(@User('orgId') orgId: string): Promise<UsageMetrics> {
        try {
            return await this.billingService.getUsageMetrics(orgId);
        } catch (error) {
            throw new HttpException('Failed to get usage metrics', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('quotas')
    @ApiOperation({ summary: 'Get quota limits for organization' })
    @ApiResponse({ status: 200, description: 'Quota limits retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getQuotas(@User('orgId') orgId: string): Promise<QuotaLimits> {
        try {
            return await this.billingService.getQuotaLimits(orgId);
        } catch (error) {
            throw new HttpException('Failed to get quota limits', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('plans')
    @ApiOperation({ summary: 'Get available billing plans' })
    @ApiResponse({ status: 200, description: 'Billing plans retrieved successfully' })
    async getPlans(): Promise<BillingPlan[]> {
        try {
            return await this.billingService.getBillingPlans();
        } catch (error) {
            throw new HttpException('Failed to get billing plans', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('current-plan')
    @ApiOperation({ summary: 'Get current billing plan for organization' })
    @ApiResponse({ status: 200, description: 'Current plan retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getCurrentPlan(@User('orgId') orgId: string): Promise<BillingPlan> {
        try {
            return await this.billingService.getCurrentPlan(orgId);
        } catch (error) {
            throw new HttpException('Failed to get current plan', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('upgrade')
    @ApiOperation({ summary: 'Upgrade organization billing plan' })
    @ApiResponse({ status: 200, description: 'Plan upgraded successfully' })
    @ApiResponse({ status: 400, description: 'Invalid plan name' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async upgradePlan(
        @User('orgId') orgId: string,
        @Body() body: { planName: string },
    ): Promise<{ message: string }> {
        try {
            await this.billingService.upgradePlan(orgId, body.planName);
            return { message: 'Plan upgraded successfully' };
        } catch (error) {
            if (error.message === 'Invalid plan name') {
                throw new HttpException('Invalid plan name', HttpStatus.BAD_REQUEST);
            }
            throw new HttpException('Failed to upgrade plan', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('usage-report')
    @ApiOperation({ summary: 'Get detailed usage report for date range' })
    @ApiResponse({ status: 200, description: 'Usage report generated successfully' })
    @ApiResponse({ status: 400, description: 'Invalid date range' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getUsageReport(
        @User('orgId') orgId: string,
        @Query('startDate') startDateStr: string,
        @Query('endDate') endDateStr: string,
    ): Promise<any> {
        try {
            const startDate = new Date(startDateStr);
            const endDate = new Date(endDateStr);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new HttpException('Invalid date format', HttpStatus.BAD_REQUEST);
            }

            if (startDate > endDate) {
                throw new HttpException('Start date must be before end date', HttpStatus.BAD_REQUEST);
            }

            return await this.billingService.getUsageReport(orgId, startDate, endDate);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException('Failed to generate usage report', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Get('check-quota/:action')
    @ApiOperation({ summary: 'Check if organization has quota for specific action' })
    @ApiResponse({ status: 200, description: 'Quota check completed' })
    @ApiResponse({ status: 400, description: 'Invalid action' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async checkQuota(
        @User('orgId') orgId: string,
        @Param('action') action: string,
    ): Promise<{ hasQuota: boolean }> {
        try {
            if (!['seed', 'serp', 'export'].includes(action)) {
                throw new HttpException('Invalid action', HttpStatus.BAD_REQUEST);
            }

            const hasQuota = await this.billingService.checkQuota(orgId, action as 'seed' | 'serp' | 'export');
            return { hasQuota };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException('Failed to check quota', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
