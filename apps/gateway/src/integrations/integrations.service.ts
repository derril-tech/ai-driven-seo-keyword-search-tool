import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import { AuditService } from '../audit/audit.service';

export interface IntegrationConfig {
    id: string;
    name: string;
    type: 'webhook' | 'api' | 'oauth';
    platform: string;
    config: Record<string, any>;
    enabled: boolean;
    tenantId: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface WebhookPayload {
    event: string;
    data: any;
    timestamp: string;
    signature?: string;
}

export interface IntegrationResponse {
    success: boolean;
    data?: any;
    error?: string;
    statusCode?: number;
    responseTime?: number;
}

@Injectable()
export class IntegrationsService {
    private readonly logger = new Logger(IntegrationsService.name);
    private readonly httpClient: AxiosInstance;

    constructor(
        @InjectRedis() private readonly redis: Redis,
        private readonly auditService: AuditService,
    ) {
        this.httpClient = axios.create({
            timeout: 30000,
            headers: {
                'User-Agent': 'SEO-Keyword-Tool/1.0',
            },
        });
    }

    async createIntegration(
        tenantId: string,
        createdBy: string,
        config: Omit<IntegrationConfig, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<IntegrationConfig> {
        try {
            const integration: IntegrationConfig = {
                ...config,
                id: this.generateId(),
                tenantId,
                createdBy,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Store in Redis for fast access
            await this.redis.hset(
                `integrations:${tenantId}`,
                integration.id,
                JSON.stringify(integration),
            );

            // Log integration creation
            await this.auditService.logDataActivity(
                { userId: createdBy, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'create',
                'integration',
                integration.id,
                { integrationName: config.name, platform: config.platform },
            );

            return integration;
        } catch (error) {
            this.logger.error(`Failed to create integration: ${error.message}`, error.stack);
            throw new HttpException('Failed to create integration', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getIntegrations(tenantId: string): Promise<IntegrationConfig[]> {
        try {
            const integrations = await this.redis.hgetall(`integrations:${tenantId}`);
            return Object.values(integrations).map(integration => JSON.parse(integration));
        } catch (error) {
            this.logger.error(`Failed to get integrations: ${error.message}`, error.stack);
            throw new HttpException('Failed to get integrations', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getIntegration(tenantId: string, integrationId: string): Promise<IntegrationConfig | null> {
        try {
            const integration = await this.redis.hget(`integrations:${tenantId}`, integrationId);
            return integration ? JSON.parse(integration) : null;
        } catch (error) {
            this.logger.error(`Failed to get integration: ${error.message}`, error.stack);
            throw new HttpException('Failed to get integration', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updateIntegration(
        tenantId: string,
        integrationId: string,
        updates: Partial<IntegrationConfig>,
        updatedBy: string,
    ): Promise<IntegrationConfig> {
        try {
            const integration = await this.getIntegration(tenantId, integrationId);
            if (!integration) {
                throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
            }

            const updatedIntegration: IntegrationConfig = {
                ...integration,
                ...updates,
                updatedAt: new Date(),
            };

            await this.redis.hset(
                `integrations:${tenantId}`,
                integrationId,
                JSON.stringify(updatedIntegration),
            );

            // Log integration update
            await this.auditService.logDataActivity(
                { userId: updatedBy, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'update',
                'integration',
                integrationId,
                { changes: updates },
            );

            return updatedIntegration;
        } catch (error) {
            this.logger.error(`Failed to update integration: ${error.message}`, error.stack);
            throw error;
        }
    }

    async deleteIntegration(
        tenantId: string,
        integrationId: string,
        deletedBy: string,
    ): Promise<void> {
        try {
            const integration = await this.getIntegration(tenantId, integrationId);
            if (!integration) {
                throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
            }

            await this.redis.hdel(`integrations:${tenantId}`, integrationId);

            // Log integration deletion
            await this.auditService.logDataActivity(
                { userId: deletedBy, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'delete',
                'integration',
                integrationId,
                { integrationName: integration.name },
            );
        } catch (error) {
            this.logger.error(`Failed to delete integration: ${error.message}`, error.stack);
            throw error;
        }
    }

    async sendWebhook(
        tenantId: string,
        event: string,
        data: any,
        integrationId?: string,
    ): Promise<IntegrationResponse[]> {
        try {
            const integrations = integrationId
                ? [await this.getIntegration(tenantId, integrationId)]
                : await this.getIntegrations(tenantId);

            const webhookIntegrations = integrations.filter(
                integration => integration.type === 'webhook' && integration.enabled,
            );

            const responses: IntegrationResponse[] = [];

            for (const integration of webhookIntegrations) {
                try {
                    const response = await this.sendWebhookToIntegration(integration, event, data);
                    responses.push(response);
                } catch (error) {
                    responses.push({
                        success: false,
                        error: error.message,
                        statusCode: error.response?.status,
                    });
                }
            }

            return responses;
        } catch (error) {
            this.logger.error(`Failed to send webhook: ${error.message}`, error.stack);
            throw new HttpException('Failed to send webhook', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async testIntegration(
        tenantId: string,
        integrationId: string,
        testData?: any,
    ): Promise<IntegrationResponse> {
        try {
            const integration = await this.getIntegration(tenantId, integrationId);
            if (!integration) {
                throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
            }

            const testPayload = testData || {
                event: 'test',
                data: { message: 'This is a test webhook from SEO Keyword Tool' },
                timestamp: new Date().toISOString(),
            };

            return await this.sendWebhookToIntegration(integration, 'test', testPayload);
        } catch (error) {
            this.logger.error(`Failed to test integration: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getIntegrationTemplates(): Promise<Array<{
        platform: string;
        name: string;
        description: string;
        configSchema: Record<string, any>;
        events: string[];
    }>> {
        return [
            {
                platform: 'slack',
                name: 'Slack Webhook',
                description: 'Send notifications to Slack channel',
                configSchema: {
                    webhook_url: { type: 'string', required: true, description: 'Slack webhook URL' },
                    channel: { type: 'string', required: false, description: 'Channel name (optional)' },
                },
                events: ['project.completed', 'export.completed', 'quota.exceeded'],
            },
            {
                platform: 'discord',
                name: 'Discord Webhook',
                description: 'Send notifications to Discord channel',
                configSchema: {
                    webhook_url: { type: 'string', required: true, description: 'Discord webhook URL' },
                },
                events: ['project.completed', 'export.completed', 'quota.exceeded'],
            },
            {
                platform: 'notion',
                name: 'Notion Integration',
                description: 'Export data to Notion database',
                configSchema: {
                    token: { type: 'string', required: true, description: 'Notion integration token' },
                    database_id: { type: 'string', required: true, description: 'Notion database ID' },
                },
                events: ['export.completed'],
            },
            {
                platform: 'google_sheets',
                name: 'Google Sheets',
                description: 'Export data to Google Sheets',
                configSchema: {
                    credentials: { type: 'object', required: true, description: 'Google service account credentials' },
                    spreadsheet_id: { type: 'string', required: true, description: 'Google Sheets spreadsheet ID' },
                },
                events: ['export.completed'],
            },
            {
                platform: 'zapier',
                name: 'Zapier Webhook',
                description: 'Connect to Zapier workflows',
                configSchema: {
                    webhook_url: { type: 'string', required: true, description: 'Zapier webhook URL' },
                },
                events: ['project.completed', 'export.completed', 'quota.exceeded'],
            },
            {
                platform: 'make',
                name: 'Make.com (Integromat)',
                description: 'Connect to Make.com scenarios',
                configSchema: {
                    webhook_url: { type: 'string', required: true, description: 'Make.com webhook URL' },
                },
                events: ['project.completed', 'export.completed', 'quota.exceeded'],
            },
        ];
    }

    private async sendWebhookToIntegration(
        integration: IntegrationConfig,
        event: string,
        data: any,
    ): Promise<IntegrationResponse> {
        const startTime = Date.now();

        try {
            const payload: WebhookPayload = {
                event,
                data,
                timestamp: new Date().toISOString(),
            };

            // Add signature if configured
            if (integration.config.secret) {
                payload.signature = this.generateSignature(payload, integration.config.secret);
            }

            const response = await this.httpClient.post(integration.config.webhook_url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SEO-Keyword-Tool/1.0',
                    'X-Integration-Id': integration.id,
                    'X-Event-Type': event,
                },
            });

            const responseTime = Date.now() - startTime;

            return {
                success: true,
                data: response.data,
                statusCode: response.status,
                responseTime,
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;

            this.logger.error(
                `Webhook delivery failed for integration ${integration.id}: ${error.message}`,
                error.stack,
            );

            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status,
                responseTime,
            };
        }
    }

    private generateSignature(payload: WebhookPayload, secret: string): string {
        const crypto = require('crypto');
        const data = JSON.stringify(payload);
        return crypto.createHmac('sha256', secret).update(data).digest('hex');
    }

    private generateId(): string {
        return `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
