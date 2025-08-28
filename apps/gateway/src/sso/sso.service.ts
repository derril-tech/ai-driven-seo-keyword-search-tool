import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as xml2js from 'xml2js';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { AuditService } from '../audit/audit.service';

export interface SSOConfig {
    id: string;
    tenantId: string;
    provider: 'saml' | 'oidc' | 'oauth2';
    enabled: boolean;
    config: {
        // SAML Configuration
        entityId?: string;
        ssoUrl?: string;
        sloUrl?: string;
        x509Certificate?: string;
        privateKey?: string;
        nameIdFormat?: string;
        // OIDC Configuration
        issuer?: string;
        clientId?: string;
        clientSecret?: string;
        authorizationUrl?: string;
        tokenUrl?: string;
        userInfoUrl?: string;
        // OAuth2 Configuration
        redirectUri?: string;
        scope?: string;
    };
    attributes: {
        email: string;
        firstName: string;
        lastName: string;
        username: string;
        groups?: string;
        department?: string;
        jobTitle?: string;
    };
    settings: {
        autoProvision: boolean;
        updateProfile: boolean;
        syncGroups: boolean;
        defaultRole: string;
        allowedDomains: string[];
    };
    createdAt: Date;
    updatedAt: Date;
    updatedBy: string;
}

export interface SAMLRequest {
    id: string;
    issueInstant: string;
    assertionConsumerServiceURL: string;
    relayState?: string;
}

export interface SAMLResponse {
    id: string;
    issueInstant: string;
    destination: string;
    status: {
        statusCode: string;
        statusMessage?: string;
    };
    assertion: {
        id: string;
        issueInstant: string;
        issuer: string;
        subject: {
            nameId: string;
            nameIdFormat: string;
        };
        conditions: {
            notBefore: string;
            notOnOrAfter: string;
        };
        attributes: Record<string, string[]>;
    };
}

export interface SSOUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    groups?: string[];
    department?: string;
    jobTitle?: string;
    provider: string;
    providerId: string;
}

@Injectable()
export class SSOService {
    private readonly logger = new Logger(SSOService.name);

    constructor(
        @InjectRepository(Tenant)
        private readonly tenantRepository: Repository<Tenant>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRedis() private readonly redis: Redis,
        private readonly jwtService: JwtService,
        private readonly auditService: AuditService,
    ) { }

    async createSSOConfig(
        tenantId: string,
        config: Omit<SSOConfig, 'id' | 'createdAt' | 'updatedAt'>,
        createdBy: string,
    ): Promise<SSOConfig> {
        try {
            // Check if tenant exists and has SSO enabled
            const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
            if (!tenant) {
                throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
            }

            if (!tenant.settings?.ssoEnabled) {
                throw new HttpException('SSO is not enabled for this tenant', HttpStatus.FORBIDDEN);
            }

            const ssoConfig: SSOConfig = {
                ...config,
                id: this.generateId(),
                tenantId,
                createdAt: new Date(),
                updatedAt: new Date(),
                updatedBy: createdBy,
            };

            // Store in Redis for fast access
            await this.redis.set(
                `sso_config:${tenantId}`,
                JSON.stringify(ssoConfig),
                'EX',
                3600, // 1 hour cache
            );

            // Also store in database for persistence
            await this.redis.hset(
                'sso_configs',
                tenantId,
                JSON.stringify(ssoConfig),
            );

            // Log SSO configuration creation
            await this.auditService.logDataActivity(
                { userId: createdBy, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'create',
                'sso_config',
                ssoConfig.id,
                { provider: config.provider, enabled: config.enabled },
            );

            return ssoConfig;
        } catch (error) {
            this.logger.error(`Failed to create SSO config: ${error.message}`, error.stack);
            throw error;
        }
    }

    async getSSOConfig(tenantId: string): Promise<SSOConfig | null> {
        try {
            // Try Redis first
            const cached = await this.redis.get(`sso_config:${tenantId}`);
            if (cached) {
                return JSON.parse(cached);
            }

            // Fallback to database
            const stored = await this.redis.hget('sso_configs', tenantId);
            if (stored) {
                const config = JSON.parse(stored);
                // Cache in Redis
                await this.redis.set(
                    `sso_config:${tenantId}`,
                    stored,
                    'EX',
                    3600,
                );
                return config;
            }

            return null;
        } catch (error) {
            this.logger.error(`Failed to get SSO config: ${error.message}`, error.stack);
            throw new HttpException('Failed to get SSO config', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async updateSSOConfig(
        tenantId: string,
        updates: Partial<SSOConfig>,
        updatedBy: string,
    ): Promise<SSOConfig> {
        try {
            const existingConfig = await this.getSSOConfig(tenantId);
            if (!existingConfig) {
                throw new HttpException('SSO config not found', HttpStatus.NOT_FOUND);
            }

            const updatedConfig: SSOConfig = {
                ...existingConfig,
                ...updates,
                updatedAt: new Date(),
                updatedBy,
            };

            // Update in Redis
            await this.redis.set(
                `sso_config:${tenantId}`,
                JSON.stringify(updatedConfig),
                'EX',
                3600,
            );

            // Update in database
            await this.redis.hset(
                'sso_configs',
                tenantId,
                JSON.stringify(updatedConfig),
            );

            // Log SSO configuration update
            await this.auditService.logDataActivity(
                { userId: updatedBy, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'update',
                'sso_config',
                updatedConfig.id,
                { changes: Object.keys(updates) },
            );

            return updatedConfig;
        } catch (error) {
            this.logger.error(`Failed to update SSO config: ${error.message}`, error.stack);
            throw error;
        }
    }

    async generateSAMLMetadata(tenantId: string): Promise<string> {
        try {
            const config = await this.getSSOConfig(tenantId);
            if (!config || config.provider !== 'saml') {
                throw new HttpException('SAML configuration not found', HttpStatus.NOT_FOUND);
            }

            const metadata = {
                'md:EntityDescriptor': {
                    $: {
                        entityID: config.config.entityId,
                        'xmlns:md': 'urn:oasis:names:tc:SAML:2.0:metadata',
                    },
                    'md:SPSSODescriptor': {
                        $: {
                            protocolSupportEnumeration: 'urn:oasis:names:tc:SAML:2.0:protocol',
                        },
                        'md:AssertionConsumerService': {
                            $: {
                                Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
                                Location: `${process.env.APP_URL}/v1/sso/saml/acs`,
                                index: '0',
                            },
                        },
                        'md:SingleLogoutService': {
                            $: {
                                Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
                                Location: `${process.env.APP_URL}/v1/sso/saml/slo`,
                            },
                        },
                    },
                },
            };

            const builder = new xml2js.Builder({
                rootName: 'md:EntityDescriptor',
                headless: true,
                renderOpts: { pretty: true, indent: '  ', newline: '\n' },
            });

            return builder.buildObject(metadata);
        } catch (error) {
            this.logger.error(`Failed to generate SAML metadata: ${error.message}`, error.stack);
            throw error;
        }
    }

    async generateSAMLRequest(tenantId: string, relayState?: string): Promise<{
        request: string;
        requestId: string;
        redirectUrl: string;
    }> {
        try {
            const config = await this.getSSOConfig(tenantId);
            if (!config || config.provider !== 'saml') {
                throw new HttpException('SAML configuration not found', HttpStatus.NOT_FOUND);
            }

            const requestId = `_${crypto.randomBytes(16).toString('hex')}`;
            const issueInstant = new Date().toISOString();

            const samlRequest: SAMLRequest = {
                id: requestId,
                issueInstant,
                assertionConsumerServiceURL: `${process.env.APP_URL}/v1/sso/saml/acs`,
                relayState,
            };

            const requestXml = {
                'samlp:AuthnRequest': {
                    $: {
                        xmlns: 'urn:oasis:names:tc:SAML:2.0:protocol',
                        'xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
                        ID: samlRequest.id,
                        Version: '2.0',
                        IssueInstant: samlRequest.issueInstant,
                        ProtocolBinding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
                        AssertionConsumerServiceURL: samlRequest.assertionConsumerServiceURL,
                    },
                    'saml:Issuer': config.config.entityId,
                },
            };

            const builder = new xml2js.Builder({
                rootName: 'samlp:AuthnRequest',
                headless: true,
            });

            const requestString = builder.buildObject(requestXml);
            const compressedRequest = Buffer.from(requestString, 'utf8').toString('base64');
            const encodedRequest = encodeURIComponent(compressedRequest);

            const redirectUrl = `${config.config.ssoUrl}?SAMLRequest=${encodedRequest}${relayState ? `&RelayState=${encodeURIComponent(relayState)}` : ''
                }`;

            return {
                request: requestString,
                requestId,
                redirectUrl,
            };
        } catch (error) {
            this.logger.error(`Failed to generate SAML request: ${error.message}`, error.stack);
            throw error;
        }
    }

    async processSAMLResponse(
        tenantId: string,
        samlResponse: string,
        relayState?: string,
    ): Promise<{
        user: SSOUser;
        token: string;
        isNewUser: boolean;
    }> {
        try {
            const config = await this.getSSOConfig(tenantId);
            if (!config || config.provider !== 'saml') {
                throw new HttpException('SAML configuration not found', HttpStatus.NOT_FOUND);
            }

            // Decode and parse SAML response
            const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf8');
            const parsedResponse = await this.parseSAMLResponse(decodedResponse, config);

            // Extract user information
            const ssoUser = this.extractUserFromSAML(parsedResponse, config);

            // Find or create user
            const { user, isNewUser } = await this.findOrCreateUser(tenantId, ssoUser, config);

            // Generate JWT token
            const token = this.generateJWTToken(user, tenantId);

            // Log successful SSO login
            await this.auditService.logAuthentication(
                { userId: user.id, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'login',
                { success: true, ssoProvider: 'saml', isNewUser },
            );

            return { user: ssoUser, token, isNewUser };
        } catch (error) {
            this.logger.error(`Failed to process SAML response: ${error.message}`, error.stack);
            throw error;
        }
    }

    async processOIDCToken(
        tenantId: string,
        code: string,
        state: string,
    ): Promise<{
        user: SSOUser;
        token: string;
        isNewUser: boolean;
    }> {
        try {
            const config = await this.getSSOConfig(tenantId);
            if (!config || config.provider !== 'oidc') {
                throw new HttpException('OIDC configuration not found', HttpStatus.NOT_FOUND);
            }

            // Exchange code for token
            const tokenResponse = await this.exchangeCodeForToken(code, config);

            // Get user info
            const userInfo = await this.getUserInfo(tokenResponse.access_token, config);

            // Extract user information
            const ssoUser = this.extractUserFromOIDC(userInfo, config);

            // Find or create user
            const { user, isNewUser } = await this.findOrCreateUser(tenantId, ssoUser, config);

            // Generate JWT token
            const token = this.generateJWTToken(user, tenantId);

            // Log successful SSO login
            await this.auditService.logAuthentication(
                { userId: user.id, tenantId, ipAddress: 'unknown', userAgent: 'unknown' },
                'login',
                { success: true, ssoProvider: 'oidc', isNewUser },
            );

            return { user: ssoUser, token, isNewUser };
        } catch (error) {
            this.logger.error(`Failed to process OIDC token: ${error.message}`, error.stack);
            throw error;
        }
    }

    async validateSSOConfig(config: SSOConfig): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
    }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (config.provider === 'saml') {
            if (!config.config.entityId) {
                errors.push('Entity ID is required for SAML');
            }
            if (!config.config.ssoUrl) {
                errors.push('SSO URL is required for SAML');
            }
            if (!config.config.x509Certificate) {
                errors.push('X.509 Certificate is required for SAML');
            }
        } else if (config.provider === 'oidc') {
            if (!config.config.issuer) {
                errors.push('Issuer is required for OIDC');
            }
            if (!config.config.clientId) {
                errors.push('Client ID is required for OIDC');
            }
            if (!config.config.clientSecret) {
                errors.push('Client Secret is required for OIDC');
            }
            if (!config.config.authorizationUrl) {
                errors.push('Authorization URL is required for OIDC');
            }
            if (!config.config.tokenUrl) {
                errors.push('Token URL is required for OIDC');
            }
        }

        if (!config.attributes.email) {
            errors.push('Email attribute mapping is required');
        }

        if (!config.attributes.firstName) {
            errors.push('First name attribute mapping is required');
        }

        if (!config.attributes.lastName) {
            errors.push('Last name attribute mapping is required');
        }

        if (config.settings.autoProvision && !config.settings.defaultRole) {
            warnings.push('Default role should be set when auto-provisioning is enabled');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    async getSSOProviders(): Promise<Array<{
        id: string;
        name: string;
        description: string;
        provider: 'saml' | 'oidc' | 'oauth2';
        configSchema: Record<string, any>;
    }>> {
        return [
            {
                id: 'azure-ad',
                name: 'Azure Active Directory',
                description: 'Microsoft Azure Active Directory SAML/OIDC integration',
                provider: 'saml',
                configSchema: {
                    entityId: { type: 'string', required: true, description: 'Entity ID (usually your app URL)' },
                    ssoUrl: { type: 'string', required: true, description: 'Azure AD SSO URL' },
                    x509Certificate: { type: 'string', required: true, description: 'Azure AD X.509 Certificate' },
                },
            },
            {
                id: 'okta',
                name: 'Okta',
                description: 'Okta SAML/OIDC integration',
                provider: 'saml',
                configSchema: {
                    entityId: { type: 'string', required: true, description: 'Entity ID' },
                    ssoUrl: { type: 'string', required: true, description: 'Okta SSO URL' },
                    x509Certificate: { type: 'string', required: true, description: 'Okta X.509 Certificate' },
                },
            },
            {
                id: 'google-workspace',
                name: 'Google Workspace',
                description: 'Google Workspace SAML integration',
                provider: 'saml',
                configSchema: {
                    entityId: { type: 'string', required: true, description: 'Entity ID' },
                    ssoUrl: { type: 'string', required: true, description: 'Google SSO URL' },
                    x509Certificate: { type: 'string', required: true, description: 'Google X.509 Certificate' },
                },
            },
            {
                id: 'onelogin',
                name: 'OneLogin',
                description: 'OneLogin SAML integration',
                provider: 'saml',
                configSchema: {
                    entityId: { type: 'string', required: true, description: 'Entity ID' },
                    ssoUrl: { type: 'string', required: true, description: 'OneLogin SSO URL' },
                    x509Certificate: { type: 'string', required: true, description: 'OneLogin X.509 Certificate' },
                },
            },
        ];
    }

    private async parseSAMLResponse(responseXml: string, config: SSOConfig): Promise<SAMLResponse> {
        try {
            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(responseXml);

            const response = result['samlp:Response'];
            const assertion = response.Assertion;

            return {
                id: response.$.ID,
                issueInstant: response.$.IssueInstant,
                destination: response.$.Destination,
                status: {
                    statusCode: response.Status.StatusCode.$.Value,
                    statusMessage: response.Status.StatusMessage?._,
                },
                assertion: {
                    id: assertion.$.ID,
                    issueInstant: assertion.$.IssueInstant,
                    issuer: assertion.Issuer._,
                    subject: {
                        nameId: assertion.Subject.NameID._,
                        nameIdFormat: assertion.Subject.NameID.$.Format,
                    },
                    conditions: {
                        notBefore: assertion.Conditions.$.NotBefore,
                        notOnOrAfter: assertion.Conditions.$.NotOnOrAfter,
                    },
                    attributes: assertion.AttributeStatement.Attribute.reduce((acc: any, attr: any) => {
                        acc[attr.$.Name] = Array.isArray(attr.AttributeValue) ? attr.AttributeValue : [attr.AttributeValue];
                        return acc;
                    }, {}),
                },
            };
        } catch (error) {
            this.logger.error(`Failed to parse SAML response: ${error.message}`, error.stack);
            throw new HttpException('Invalid SAML response', HttpStatus.BAD_REQUEST);
        }
    }

    private extractUserFromSAML(samlResponse: SAMLResponse, config: SSOConfig): SSOUser {
        const attributes = samlResponse.assertion.attributes;

        return {
            id: samlResponse.assertion.subject.nameId,
            email: attributes[config.attributes.email]?.[0] || '',
            firstName: attributes[config.attributes.firstName]?.[0] || '',
            lastName: attributes[config.attributes.lastName]?.[0] || '',
            username: attributes[config.attributes.username]?.[0] || samlResponse.assertion.subject.nameId,
            groups: attributes[config.attributes.groups] || [],
            department: attributes[config.attributes.department]?.[0],
            jobTitle: attributes[config.attributes.jobTitle]?.[0],
            provider: 'saml',
            providerId: samlResponse.assertion.subject.nameId,
        };
    }

    private extractUserFromOIDC(userInfo: any, config: SSOConfig): SSOUser {
        return {
            id: userInfo.sub,
            email: userInfo[config.attributes.email] || userInfo.email || '',
            firstName: userInfo[config.attributes.firstName] || userInfo.given_name || '',
            lastName: userInfo[config.attributes.lastName] || userInfo.family_name || '',
            username: userInfo[config.attributes.username] || userInfo.preferred_username || userInfo.sub,
            groups: userInfo[config.attributes.groups] || userInfo.groups || [],
            department: userInfo[config.attributes.department],
            jobTitle: userInfo[config.attributes.jobTitle],
            provider: 'oidc',
            providerId: userInfo.sub,
        };
    }

    private async findOrCreateUser(
        tenantId: string,
        ssoUser: SSOUser,
        config: SSOConfig,
    ): Promise<{ user: User; isNewUser: boolean }> {
        // Try to find existing user by SSO provider ID
        let user = await this.userRepository.findOne({
            where: {
                tenant_id: tenantId,
                sso_provider: ssoUser.provider,
                sso_provider_id: ssoUser.providerId,
            },
        });

        if (!user) {
            // Try to find by email
            user = await this.userRepository.findOne({
                where: {
                    tenant_id: tenantId,
                    email: ssoUser.email,
                },
            });

            if (user) {
                // Update existing user with SSO information
                user.sso_provider = ssoUser.provider;
                user.sso_provider_id = ssoUser.providerId;
                await this.userRepository.save(user);
            } else if (config.settings.autoProvision) {
                // Create new user
                user = this.userRepository.create({
                    tenant_id: tenantId,
                    email: ssoUser.email,
                    first_name: ssoUser.firstName,
                    last_name: ssoUser.lastName,
                    username: ssoUser.username,
                    sso_provider: ssoUser.provider,
                    sso_provider_id: ssoUser.providerId,
                    status: 'active',
                    email_verified_at: new Date(),
                });

                await this.userRepository.save(user);
            } else {
                throw new HttpException('User not found and auto-provisioning is disabled', HttpStatus.FORBIDDEN);
            }
        }

        // Update user profile if configured
        if (config.settings.updateProfile) {
            user.first_name = ssoUser.firstName;
            user.last_name = ssoUser.lastName;
            user.job_title = ssoUser.jobTitle;
            user.department = ssoUser.department;
            await this.userRepository.save(user);
        }

        return { user, isNewUser: !user.created_at };
    }

    private generateJWTToken(user: User, tenantId: string): string {
        const payload = {
            sub: user.id,
            email: user.email,
            tenantId,
            orgId: user.org_id,
            ssoProvider: user.sso_provider,
        };

        return this.jwtService.sign(payload);
    }

    private async exchangeCodeForToken(code: string, config: SSOConfig): Promise<any> {
        // Mock implementation - in production, make actual HTTP request
        return {
            access_token: 'mock_access_token',
            token_type: 'Bearer',
            expires_in: 3600,
        };
    }

    private async getUserInfo(accessToken: string, config: SSOConfig): Promise<any> {
        // Mock implementation - in production, make actual HTTP request
        return {
            sub: 'mock_user_id',
            email: 'user@example.com',
            given_name: 'John',
            family_name: 'Doe',
            preferred_username: 'johndoe',
        };
    }

    private generateId(): string {
        return `sso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
