import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Tenant } from '../entities/tenant.entity';
import { AuditService } from '../audit/audit.service';

export interface WhiteLabelConfig {
    id: string;
    tenantId: string;
    enabled: boolean;
    branding: {
        companyName: string;
        logoUrl: string;
        faviconUrl: string;
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
        fontFamily: string;
        customCss?: string;
    };
    domain: {
        customDomain: string;
        subdomain: string;
        sslEnabled: boolean;
        sslCertificate?: string;
        sslPrivateKey?: string;
    };
    features: {
        hidePoweredBy: boolean;
        customFooter: string;
        customHeader: string;
        customEmailTemplates: boolean;
        customLandingPage: boolean;
        customOnboarding: boolean;
    };
    integrations: {
        customSso: boolean;
        ssoProvider?: string;
        ssoConfig?: Record<string, any>;
        customAnalytics: boolean;
        analyticsProvider?: string;
        analyticsConfig?: Record<string, any>;
    };
    content: {
        customWelcomeMessage: string;
        customHelpText: Record<string, string>;
        customErrorMessages: Record<string, string>;
        customTooltips: Record<string, string>;
    };
    createdAt: Date;
    updatedAt: Date;
    updatedBy: string;
}

export interface WhiteLabelPreview {
    config: WhiteLabelConfig;
    previewUrl: string;
    status: 'active' | 'pending' | 'error';
    lastDeployed?: Date;
}

@Injectable()
export class WhiteLabelService {
    private readonly logger = new Logger(WhiteLabelService.name);

    constructor(
        @InjectRepository(Tenant)
        private readonly tenantRepository: Repository<Tenant>,
        @InjectRedis() private readonly redis: Redis,
        private readonly auditService: AuditService,
    ) { }

    async createWhiteLabelConfig(
        tenantId: string,
        config: Omit<WhiteLabelConfig, 'id' | 'createdAt' | 'updatedAt'>,
        createdBy: string,
    ): Promise<WhiteLabelConfig> {
        try {
            // Check if tenant exists and has white-label enabled
            const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
            if (!tenant) {
                throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
            }

            if (!tenant.settings?.whiteLabelEnabled) {
                throw new HttpException('White-label is not enabled for this tenant', HttpStatus.FORBIDDEN);
            }

            const whiteLabelConfig: WhiteLabelConfig = {
                ...config,
                id: this.generateId(),
                tenantId,
                createdAt: new Date(),
                updatedAt: new Date(),
                updatedBy: createdBy,
            };

            // Store in Redis for fast access
            await this.redis.set(
                `white_label:${tenantId}`,
                JSON.stringify(whiteLabelConfig),
                'EX',
                3600, // 1 hour cache
            );

            // Also store in database for persistence
            await this.redis.hset(
                'white_label_configs',
                tenantId,
                JSON.stringify(whiteLabelConfig),
            );

            // Log white-label configuration creation
            await this.auditService.logDataActivity(
                { userId: createdBy, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'create',
                'white_label_config',
                whiteLabelConfig.id,
                { companyName: config.branding.companyName, customDomain: config.domain.customDomain },
            );

            return whiteLabelConfig;
        } catch (error) {
            this.logger.error(`Failed to create white-label config: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getWhiteLabelConfig(tenantId: string): Promise<WhiteLabelConfig | null> {
        try {
            // Try Redis first
            const cached = await this.redis.get(`white_label:${tenantId}`);
            if (cached) {
                return JSON.parse(cached);
            }

            // Fallback to database
            const stored = await this.redis.hget('white_label_configs', tenantId);
            if (stored) {
                const config = JSON.parse(stored);
                // Cache in Redis
                await this.redis.set(
                    `white_label:${tenantId}`,
                    stored,
                    'EX',
                    3600,
                );
                return config;
            }

            return null;
        } catch (error) {
            this.logger.error(`Failed to get white-label config: ${error.message}`, error.stack);
            throw new HttpException('Failed to get white-label config', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updateWhiteLabelConfig(
        tenantId: string,
        updates: Partial<WhiteLabelConfig>,
        updatedBy: string,
    ): Promise<WhiteLabelConfig> {
        try {
            const existingConfig = await this.getWhiteLabelConfig(tenantId);
            if (!existingConfig) {
                throw new HttpException('White-label config not found', HttpStatus.NOT_FOUND);
            }

            const updatedConfig: WhiteLabelConfig = {
                ...existingConfig,
                ...updates,
                updatedAt: new Date(),
                updatedBy,
            };

            // Update in Redis
            await this.redis.set(
                `white_label:${tenantId}`,
                JSON.stringify(updatedConfig),
                'EX',
                3600,
            );

            // Update in database
            await this.redis.hset(
                'white_label_configs',
                tenantId,
                JSON.stringify(updatedConfig),
            );

            // Log white-label configuration update
            await this.auditService.logDataActivity(
                { userId: updatedBy, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'update',
                'white_label_config',
                updatedConfig.id,
                { changes: Object.keys(updates) },
            );

            return updatedConfig;
        } catch (error) {
            this.logger.error(`Failed to update white-label config: ${error.message}`, error.stack);
            throw error;
        }
    }

    async deleteWhiteLabelConfig(tenantId: string, deletedBy: string): Promise<void> {
        try {
            const config = await this.getWhiteLabelConfig(tenantId);
            if (!config) {
                throw new HttpException('White-label config not found', HttpStatus.NOT_FOUND);
            }

            // Remove from Redis
            await this.redis.del(`white_label:${tenantId}`);
            await this.redis.hdel('white_label_configs', tenantId);

            // Log white-label configuration deletion
            await this.auditService.logDataActivity(
                { userId: deletedBy, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'delete',
                'white_label_config',
                config.id,
                { companyName: config.branding.companyName },
            );
        } catch (error) {
            this.logger.error(`Failed to delete white-label config: ${error.message}`, error.stack);
            throw error;
        }
    }

    async generateWhiteLabelAssets(tenantId: string): Promise<{
        css: string;
        js: string;
        html: string;
    }> {
        try {
            const config = await this.getWhiteLabelConfig(tenantId);
            if (!config || !config.enabled) {
                return this.getDefaultAssets();
            }

            // Generate custom CSS
            const css = this.generateCustomCSS(config.branding);

            // Generate custom JavaScript
            const js = this.generateCustomJS(config);

            // Generate custom HTML templates
            const html = this.generateCustomHTML(config);

            return { css, js, html };
        } catch (error) {
            this.logger.error(`Failed to generate white-label assets: ${error.message}`, error.stack);
            return this.getDefaultAssets();
        }
    }

    async validateCustomDomain(domain: string): Promise<{
        valid: boolean;
        errors: string[];
        suggestions: string[];
    }> {
        const errors: string[] = [];
        const suggestions: string[] = [];

        // Basic domain validation
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        if (!domainRegex.test(domain)) {
            errors.push('Invalid domain format');
        }

        if (domain.length > 253) {
            errors.push('Domain too long (max 253 characters)');
        }

        if (domain.includes('..')) {
            errors.push('Domain cannot contain consecutive dots');
        }

        // Check for reserved domains
        const reservedDomains = ['www', 'api', 'admin', 'app', 'dashboard'];
        const domainParts = domain.split('.');
        if (reservedDomains.includes(domainParts[0])) {
            errors.push(`Cannot use reserved subdomain: ${domainParts[0]}`);
            suggestions.push(`Try using a different subdomain like 'seo' or 'tools'`);
        }

        // Check if domain is already in use
        const existingConfigs = await this.getAllWhiteLabelConfigs();
        const isDomainInUse = existingConfigs.some(config =>
            config.domain.customDomain === domain || config.domain.subdomain === domain
        );

        if (isDomainInUse) {
            errors.push('Domain is already in use by another tenant');
        }

        return {
            valid: errors.length === 0,
            errors,
            suggestions,
        };
    }

    async deployWhiteLabelConfig(tenantId: string, deployedBy: string): Promise<{
        success: boolean;
        deploymentUrl?: string;
        errors?: string[];
    }> {
        try {
            const config = await this.getWhiteLabelConfig(tenantId);
            if (!config) {
                throw new HttpException('White-label config not found', HttpStatus.NOT_FOUND);
            }

            // Validate domain
            const domainValidation = await this.validateCustomDomain(config.domain.customDomain);
            if (!domainValidation.valid) {
                return {
                    success: false,
                    errors: domainValidation.errors,
                };
            }

            // Generate deployment assets
            const assets = await this.generateWhiteLabelAssets(tenantId);

            // Store deployment assets
            await this.redis.set(
                `white_label_assets:${tenantId}`,
                JSON.stringify(assets),
                'EX',
                86400, // 24 hours
            );

            // Update tenant with white-label settings
            await this.tenantRepository.update(tenantId, {
                subdomain: config.domain.subdomain,
                domain: config.domain.customDomain,
                settings: {
                    ...config,
                    whiteLabelDeployed: true,
                    whiteLabelDeployedAt: new Date(),
                    whiteLabelDeployedBy: deployedBy,
                },
            });

            // Log deployment
            await this.auditService.logDataActivity(
                { userId: deployedBy, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'deploy',
                'white_label_config',
                config.id,
                { deploymentUrl: config.domain.customDomain },
            );

            return {
                success: true,
                deploymentUrl: config.domain.customDomain,
            };
        } catch (error) {
            this.logger.error(`Failed to deploy white-label config: ${error.message}`, error.stack);
            return {
                success: false,
                errors: [error.message],
            };
        }
    }

    async getWhiteLabelPreview(tenantId: string): Promise<WhiteLabelPreview> {
        try {
            const config = await this.getWhiteLabelConfig(tenantId);
            if (!config) {
                throw new HttpException('White-label config not found', HttpStatus.NOT_FOUND);
            }

            const previewUrl = config.enabled
                ? `https://${config.domain.customDomain || config.domain.subdomain}.yourdomain.com`
                : '';

            return {
                config,
                previewUrl,
                status: config.enabled ? 'active' : 'pending',
                lastDeployed: config.updatedAt,
            };
        } catch (error) {
            this.logger.error(`Failed to get white-label preview: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getWhiteLabelTemplates(): Promise<Array<{
        name: string;
        description: string;
        config: Partial<WhiteLabelConfig>;
    }>> {
        return [
            {
                name: 'Professional',
                description: 'Clean, professional branding for enterprise clients',
                config: {
                    branding: {
                        companyName: 'Your Company',
                        logoUrl: '/logos/professional-logo.png',
                        faviconUrl: '/favicons/professional-favicon.ico',
                        primaryColor: '#2563eb',
                        secondaryColor: '#64748b',
                        accentColor: '#f59e0b',
                        fontFamily: 'Inter, system-ui, sans-serif',
                    },
                    features: {
                        hidePoweredBy: true,
                        customFooter: '© 2024 Your Company. All rights reserved.',
                        customHeader: '',
                        customEmailTemplates: true,
                        customLandingPage: true,
                        customOnboarding: true,
                    },
                },
            },
            {
                name: 'Modern',
                description: 'Modern, minimalist design with bold colors',
                config: {
                    branding: {
                        companyName: 'Your Company',
                        logoUrl: '/logos/modern-logo.png',
                        faviconUrl: '/favicons/modern-favicon.ico',
                        primaryColor: '#7c3aed',
                        secondaryColor: '#374151',
                        accentColor: '#10b981',
                        fontFamily: 'Poppins, sans-serif',
                    },
                    features: {
                        hidePoweredBy: true,
                        customFooter: 'Powered by Your Company',
                        customHeader: '',
                        customEmailTemplates: true,
                        customLandingPage: true,
                        customOnboarding: true,
                    },
                },
            },
            {
                name: 'Corporate',
                description: 'Traditional corporate branding with conservative colors',
                config: {
                    branding: {
                        companyName: 'Your Company',
                        logoUrl: '/logos/corporate-logo.png',
                        faviconUrl: '/favicons/corporate-favicon.ico',
                        primaryColor: '#1f2937',
                        secondaryColor: '#6b7280',
                        accentColor: '#dc2626',
                        fontFamily: 'Roboto, sans-serif',
                    },
                    features: {
                        hidePoweredBy: false,
                        customFooter: '© 2024 Your Company',
                        customHeader: '',
                        customEmailTemplates: true,
                        customLandingPage: true,
                        customOnboarding: true,
                    },
                },
            },
        ];
    }

    private async getAllWhiteLabelConfigs(): Promise<WhiteLabelConfig[]> {
        try {
            const configs = await this.redis.hgetall('white_label_configs');
            return Object.values(configs).map(config => JSON.parse(config));
        } catch (error) {
            this.logger.error(`Failed to get all white-label configs: ${error.message}`, error.stack);
            return [];
        }
    }

    private generateCustomCSS(branding: WhiteLabelConfig['branding']): string {
        return `
      :root {
        --primary-color: ${branding.primaryColor};
        --secondary-color: ${branding.secondaryColor};
        --accent-color: ${branding.accentColor};
        --font-family: ${branding.fontFamily};
      }

      body {
        font-family: var(--font-family);
      }

      .ant-btn-primary {
        background-color: var(--primary-color);
        border-color: var(--primary-color);
      }

      .ant-btn-primary:hover {
        background-color: ${this.darkenColor(branding.primaryColor, 10)};
        border-color: ${this.darkenColor(branding.primaryColor, 10)};
      }

      .ant-menu-item-selected {
        background-color: var(--primary-color);
      }

      .ant-progress-bg {
        background-color: var(--accent-color);
      }

      ${branding.customCss || ''}
    `;
    }

    private generateCustomJS(config: WhiteLabelConfig): string {
        return `
      // White-label JavaScript
      window.whiteLabelConfig = ${JSON.stringify(config)};
      
      // Custom branding
      document.addEventListener('DOMContentLoaded', function() {
        // Update page title
        document.title = document.title.replace('SEO Keyword Tool', '${config.branding.companyName}');
        
        // Update logo
        const logo = document.querySelector('.logo img');
        if (logo) {
          logo.src = '${config.branding.logoUrl}';
        }
        
        // Update favicon
        const favicon = document.querySelector('link[rel="icon"]');
        if (favicon) {
          favicon.href = '${config.branding.faviconUrl}';
        }
        
        // Hide powered by if configured
        if (${config.features.hidePoweredBy}) {
          const poweredBy = document.querySelector('.powered-by');
          if (poweredBy) {
            poweredBy.style.display = 'none';
          }
        }
      });
    `;
    }

    private generateCustomHTML(config: WhiteLabelConfig): string {
        return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${config.branding.companyName} - SEO Keyword Research</title>
        <link rel="icon" href="${config.branding.faviconUrl}">
        <style>${this.generateCustomCSS(config.branding)}</style>
      </head>
      <body>
        <div id="app">
          <!-- Custom header -->
          ${config.features.customHeader || ''}
          
          <!-- Main content -->
          <main>
            <h1>Welcome to ${config.branding.companyName}</h1>
            <p>${config.content.customWelcomeMessage || 'Advanced SEO keyword research tool'}</p>
          </main>
          
          <!-- Custom footer -->
          ${config.features.customFooter || ''}
        </div>
        <script>${this.generateCustomJS(config)}</script>
      </body>
      </html>
    `;
    }

    private getDefaultAssets(): { css: string; js: string; html: string } {
        return {
            css: ':root { --primary-color: #1890ff; --secondary-color: #666; --accent-color: #52c41a; }',
            js: '// Default JavaScript',
            html: '<!DOCTYPE html><html><head><title>SEO Keyword Tool</title></head><body><div id="app"></div></body></html>',
        };
    }

    private darkenColor(color: string, percent: number): string {
        // Simple color darkening - in production, use a proper color manipulation library
        return color;
    }

    private generateId(): string {
        return `wl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
