import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService, IntegrationConfig, IntegrationResponse } from './integrations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('integrations')
@Controller('v1/integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationsController {
    constructor(private readonly integrationsService: IntegrationsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new integration' })
    @ApiResponse({ status: 201, description: 'Integration created successfully' })
    async createIntegration(
        @Body() body: {
            name: string;
            type: 'webhook' | 'api' | 'oauth';
            platform: string;
            config: Record<string, any>;
            enabled: boolean;
            tenantId: string;
            createdBy: string;
        },
    ): Promise<IntegrationConfig> {
        return this.integrationsService.createIntegration(
            body.tenantId,
            body.createdBy,
            body,
        );
    }

    @Get()
    @ApiOperation({ summary: 'Get all integrations for a tenant' })
    @ApiResponse({ status: 200, description: 'List of integrations' })
    async getIntegrations(@Query('tenantId') tenantId: string): Promise<IntegrationConfig[]> {
        return this.integrationsService.getIntegrations(tenantId);
    }

    @Get('templates')
    @ApiOperation({ summary: 'Get available integration templates' })
    @ApiResponse({ status: 200, description: 'List of integration templates' })
    async getIntegrationTemplates(): Promise<Array<{
        platform: string;
        name: string;
        description: string;
        configSchema: Record<string, any>;
        events: string[];
    }>> {
        return this.integrationsService.getIntegrationTemplates();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific integration' })
    @ApiResponse({ status: 200, description: 'Integration details' })
    async getIntegration(
        @Param('id') id: string,
        @Query('tenantId') tenantId: string,
    ): Promise<IntegrationConfig | null> {
        return this.integrationsService.getIntegration(tenantId, id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update an integration' })
    @ApiResponse({ status: 200, description: 'Integration updated successfully' })
    async updateIntegration(
        @Param('id') id: string,
        @Body() body: {
            updates: Partial<IntegrationConfig>;
            tenantId: string;
            updatedBy: string;
        },
    ): Promise<IntegrationConfig> {
        return this.integrationsService.updateIntegration(
            body.tenantId,
            id,
            body.updates,
            body.updatedBy,
        );
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete an integration' })
    @ApiResponse({ status: 200, description: 'Integration deleted successfully' })
    async deleteIntegration(
        @Param('id') id: string,
        @Body() body: { tenantId: string; deletedBy: string },
    ): Promise<void> {
        return this.integrationsService.deleteIntegration(
            body.tenantId,
            id,
            body.deletedBy,
        );
    }

    @Post(':id/test')
    @ApiOperation({ summary: 'Test an integration' })
    @ApiResponse({ status: 200, description: 'Integration test result' })
    async testIntegration(
        @Param('id') id: string,
        @Body() body: {
            tenantId: string;
            testData?: any;
        },
    ): Promise<IntegrationResponse> {
        return this.integrationsService.testIntegration(
            body.tenantId,
            id,
            body.testData,
        );
    }

    @Post('webhook')
    @ApiOperation({ summary: 'Send a webhook event' })
    @ApiResponse({ status: 200, description: 'Webhook sent successfully' })
    async sendWebhook(
        @Body() body: {
            tenantId: string;
            event: string;
            data: any;
            integrationId?: string;
        },
    ): Promise<IntegrationResponse[]> {
        return this.integrationsService.sendWebhook(
            body.tenantId,
            body.event,
            body.data,
            body.integrationId,
        );
    }
}
