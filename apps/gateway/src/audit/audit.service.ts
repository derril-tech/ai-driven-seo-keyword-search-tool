import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction, AuditSeverity } from '../entities/audit-log.entity';
import { Request } from 'express';

export interface AuditContext {
    userId?: string;
    tenantId: string;
    orgId?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
    httpMethod?: string;
    endpoint?: string;
    statusCode?: number;
    responseTime?: number;
    isSuccess?: boolean;
    errorMessage?: string;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    country?: string;
    city?: string;
    timezone?: string;
    isAutomated?: boolean;
}

export interface AuditEvent {
    action: AuditAction;
    severity?: AuditSeverity;
    resourceType?: string;
    resourceId?: string;
    description?: string;
    details?: {
        before?: any;
        after?: any;
        changes?: any;
        metadata?: any;
        context?: any;
    };
    requiresReview?: boolean;
}

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(
        @InjectRepository(AuditLog)
        private readonly auditLogRepository: Repository<AuditLog>,
    ) { }

    async logEvent(
        context: AuditContext,
        event: AuditEvent
    ): Promise<AuditLog> {
        try {
            const auditLog = this.auditLogRepository.create({
                tenant_id: context.tenantId,
                user_id: context.userId,
                org_id: context.orgId,
                action: event.action,
                severity: event.severity || this.getDefaultSeverity(event.action),
                resource_type: event.resourceType,
                resource_id: event.resourceId,
                description: event.description,
                details: event.details,
                ip_address: context.ipAddress,
                user_agent: context.userAgent,
                session_id: context.sessionId,
                request_id: context.requestId,
                http_method: context.httpMethod,
                endpoint: context.endpoint,
                status_code: context.statusCode,
                response_time: context.responseTime,
                is_success: context.isSuccess,
                error_message: context.errorMessage,
                request_headers: context.requestHeaders,
                response_headers: context.responseHeaders,
                country: context.country,
                city: context.city,
                timezone: context.timezone,
                is_automated: context.isAutomated || false,
                requires_review: event.requiresReview || false,
            });

            const savedLog = await this.auditLogRepository.save(auditLog);

            // Log to console for development/debugging
            this.logger.log(`Audit: ${event.action} - ${event.description || 'No description'}`);

            return savedLog;
        } catch (error) {
            this.logger.error(`Error logging audit event: ${error.message}`);
            throw error;
        }
    }

    async logFromRequest(
        req: Request,
        context: Omit<AuditContext, 'ipAddress' | 'userAgent' | 'httpMethod' | 'endpoint'>,
        event: AuditEvent
    ): Promise<AuditLog> {
        const auditContext: AuditContext = {
            ...context,
            ipAddress: this.getClientIp(req),
            userAgent: req.get('User-Agent'),
            httpMethod: req.method,
            endpoint: req.originalUrl,
        };

        return this.logEvent(auditContext, event);
    }

    async logAuthentication(
        context: AuditContext,
        action: 'login' | 'logout' | 'login_failed' | 'password_change' | 'password_reset',
        details?: {
            success?: boolean;
            failureReason?: string;
            mfaUsed?: boolean;
            sessionDuration?: number;
        }
    ): Promise<AuditLog> {
        const severity = action === 'login_failed' ? AuditSeverity.MEDIUM : AuditSeverity.LOW;

        return this.logEvent(context, {
            action: AuditAction[action.toUpperCase() as keyof typeof AuditAction],
            severity,
            description: this.getAuthDescription(action, details),
            details: { metadata: details },
            requiresReview: action === 'login_failed' && details?.failureReason === 'suspicious_activity',
        });
    }

    async logUserManagement(
        context: AuditContext,
        action: 'create' | 'update' | 'delete' | 'invite' | 'activate' | 'deactivate',
        userId: string,
        details?: {
            before?: any;
            after?: any;
            changes?: any;
            targetUserId?: string;
            reason?: string;
        }
    ): Promise<AuditLog> {
        const severity = action === 'delete' ? AuditSeverity.HIGH : AuditSeverity.MEDIUM;

        return this.logEvent(context, {
            action: AuditAction[`USER_${action.toUpperCase()}` as keyof typeof AuditAction],
            severity,
            resourceType: 'user',
            resourceId: userId,
            description: this.getUserManagementDescription(action, details),
            details: {
                before: details?.before,
                after: details?.after,
                changes: details?.changes,
                metadata: details,
            },
            requiresReview: action === 'delete' || action === 'deactivate',
        });
    }

    async logRoleManagement(
        context: AuditContext,
        action: 'create' | 'update' | 'delete' | 'assign' | 'revoke',
        roleId: string,
        details?: {
            roleName?: string;
            targetUserId?: string;
            permissions?: string[];
            before?: any;
            after?: any;
            changes?: any;
        }
    ): Promise<AuditLog> {
        const severity = action === 'delete' ? AuditSeverity.HIGH : AuditSeverity.MEDIUM;

        return this.logEvent(context, {
            action: AuditAction[`ROLE_${action.toUpperCase()}` as keyof typeof AuditAction],
            severity,
            resourceType: 'role',
            resourceId: roleId,
            description: this.getRoleManagementDescription(action, details),
            details: {
                before: details?.before,
                after: details?.after,
                changes: details?.changes,
                metadata: details,
            },
            requiresReview: action === 'delete' || action === 'revoke',
        });
    }

    async logProjectActivity(
        context: AuditContext,
        action: 'create' | 'update' | 'delete' | 'export',
        projectId: string,
        details?: {
            projectName?: string;
            changes?: any;
            exportFormat?: string;
            exportSize?: number;
        }
    ): Promise<AuditLog> {
        const severity = action === 'delete' ? AuditSeverity.HIGH : AuditSeverity.LOW;

        return this.logEvent(context, {
            action: AuditAction[`PROJECT_${action.toUpperCase()}` as keyof typeof AuditAction],
            severity,
            resourceType: 'project',
            resourceId: projectId,
            description: this.getProjectDescription(action, details),
            details: {
                changes: details?.changes,
                metadata: details,
            },
            requiresReview: action === 'delete',
        });
    }

    async logDataActivity(
        context: AuditContext,
        action: 'export' | 'import' | 'delete' | 'anonymize',
        resourceType: string,
        resourceId: string,
        details?: {
            dataSize?: number;
            recordCount?: number;
            format?: string;
            destination?: string;
            reason?: string;
        }
    ): Promise<AuditLog> {
        const severity = action === 'delete' ? AuditSeverity.HIGH : AuditSeverity.MEDIUM;

        return this.logEvent(context, {
            action: AuditAction[`DATA_${action.toUpperCase()}` as keyof typeof AuditAction],
            severity,
            resourceType,
            resourceId,
            description: this.getDataDescription(action, details),
            details: { metadata: details },
            requiresReview: action === 'delete' || action === 'anonymize',
        });
    }

    async logApiActivity(
        context: AuditContext,
        action: 'call' | 'rate_limit',
        details?: {
            endpoint?: string;
            method?: string;
            statusCode?: number;
            responseTime?: number;
            rateLimitExceeded?: boolean;
            apiKeyId?: string;
        }
    ): Promise<AuditLog> {
        const severity = action === 'rate_limit' ? AuditSeverity.MEDIUM : AuditSeverity.LOW;

        return this.logEvent(context, {
            action: AuditAction[`API_${action.toUpperCase()}` as keyof typeof AuditAction],
            severity,
            description: this.getApiDescription(action, details),
            details: { metadata: details },
            requiresReview: action === 'rate_limit',
        });
    }

    async logSecurityEvent(
        context: AuditContext,
        action: 'suspicious_activity' | 'ip_block' | 'ip_unblock' | 'session_terminate',
        details?: {
            reason?: string;
            ipAddress?: string;
            sessionId?: string;
            threatLevel?: 'low' | 'medium' | 'high' | 'critical';
            automated?: boolean;
        }
    ): Promise<AuditLog> {
        const severity = this.getSecuritySeverity(action, details?.threatLevel);

        return this.logEvent(context, {
            action: AuditAction[action.toUpperCase() as keyof typeof AuditAction],
            severity,
            description: this.getSecurityDescription(action, details),
            details: { metadata: details },
            requiresReview: true,
        });
    }

    async getAuditLogs(
        tenantId: string,
        filters: {
            userId?: string;
            orgId?: string;
            action?: AuditAction;
            severity?: AuditSeverity;
            resourceType?: string;
            resourceId?: string;
            startDate?: Date;
            endDate?: Date;
            requiresReview?: boolean;
        },
        pagination: {
            page: number;
            limit: number;
        }
    ): Promise<{ logs: AuditLog[]; total: number }> {
        try {
            const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log');

            queryBuilder.where('audit_log.tenant_id = :tenantId', { tenantId });

            if (filters.userId) {
                queryBuilder.andWhere('audit_log.user_id = :userId', { userId: filters.userId });
            }

            if (filters.orgId) {
                queryBuilder.andWhere('audit_log.org_id = :orgId', { orgId: filters.orgId });
            }

            if (filters.action) {
                queryBuilder.andWhere('audit_log.action = :action', { action: filters.action });
            }

            if (filters.severity) {
                queryBuilder.andWhere('audit_log.severity = :severity', { severity: filters.severity });
            }

            if (filters.resourceType) {
                queryBuilder.andWhere('audit_log.resource_type = :resourceType', { resourceType: filters.resourceType });
            }

            if (filters.resourceId) {
                queryBuilder.andWhere('audit_log.resource_id = :resourceId', { resourceId: filters.resourceId });
            }

            if (filters.startDate) {
                queryBuilder.andWhere('audit_log.created_at >= :startDate', { startDate: filters.startDate });
            }

            if (filters.endDate) {
                queryBuilder.andWhere('audit_log.created_at <= :endDate', { endDate: filters.endDate });
            }

            if (filters.requiresReview !== undefined) {
                queryBuilder.andWhere('audit_log.requires_review = :requiresReview', { requiresReview: filters.requiresReview });
            }

            queryBuilder.orderBy('audit_log.created_at', 'DESC');

            const total = await queryBuilder.getCount();

            queryBuilder
                .skip((pagination.page - 1) * pagination.limit)
                .take(pagination.limit);

            const logs = await queryBuilder.getMany();

            return { logs, total };
        } catch (error) {
            this.logger.error(`Error getting audit logs: ${error.message}`);
            throw error;
        }
    }

    async getAuditSummary(
        tenantId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{
        totalEvents: number;
        eventsByAction: Record<string, number>;
        eventsBySeverity: Record<string, number>;
        eventsByUser: Record<string, number>;
        requiresReview: number;
        suspiciousActivity: number;
    }> {
        try {
            const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log');

            queryBuilder
                .where('audit_log.tenant_id = :tenantId', { tenantId })
                .andWhere('audit_log.created_at >= :startDate', { startDate })
                .andWhere('audit_log.created_at <= :endDate', { endDate });

            const logs = await queryBuilder.getMany();

            const summary = {
                totalEvents: logs.length,
                eventsByAction: {},
                eventsBySeverity: {},
                eventsByUser: {},
                requiresReview: 0,
                suspiciousActivity: 0,
            };

            logs.forEach(log => {
                // Count by action
                summary.eventsByAction[log.action] = (summary.eventsByAction[log.action] || 0) + 1;

                // Count by severity
                summary.eventsBySeverity[log.severity] = (summary.eventsBySeverity[log.severity] || 0) + 1;

                // Count by user
                if (log.user_id) {
                    summary.eventsByUser[log.user_id] = (summary.eventsByUser[log.user_id] || 0) + 1;
                }

                // Count requires review
                if (log.requires_review) {
                    summary.requiresReview++;
                }

                // Count suspicious activity
                if (log.action === AuditAction.SUSPICIOUS_ACTIVITY) {
                    summary.suspiciousActivity++;
                }
            });

            return summary;
        } catch (error) {
            this.logger.error(`Error getting audit summary: ${error.message}`);
            throw error;
        }
    }

    async reviewAuditLog(
        logId: string,
        reviewedBy: string,
        reviewNotes: string,
        action: 'approve' | 'reject' | 'escalate'
    ): Promise<AuditLog> {
        try {
            const auditLog = await this.auditLogRepository.findOne({
                where: { id: logId }
            });

            if (!auditLog) {
                throw new Error('Audit log not found');
            }

            auditLog.reviewed_by = reviewedBy;
            auditLog.reviewed_at = new Date();
            auditLog.review_notes = reviewNotes;

            return await this.auditLogRepository.save(auditLog);
        } catch (error) {
            this.logger.error(`Error reviewing audit log: ${error.message}`);
            throw error;
        }
    }

    private getDefaultSeverity(action: AuditAction): AuditSeverity {
        const severityMap: Record<AuditAction, AuditSeverity> = {
            [AuditAction.LOGIN]: AuditSeverity.LOW,
            [AuditAction.LOGOUT]: AuditSeverity.LOW,
            [AuditAction.LOGIN_FAILED]: AuditSeverity.MEDIUM,
            [AuditAction.PASSWORD_CHANGE]: AuditSeverity.MEDIUM,
            [AuditAction.PASSWORD_RESET]: AuditSeverity.MEDIUM,
            [AuditAction.MFA_ENABLE]: AuditSeverity.MEDIUM,
            [AuditAction.MFA_DISABLE]: AuditSeverity.MEDIUM,
            [AuditAction.USER_CREATE]: AuditSeverity.MEDIUM,
            [AuditAction.USER_UPDATE]: AuditSeverity.MEDIUM,
            [AuditAction.USER_DELETE]: AuditSeverity.HIGH,
            [AuditAction.USER_INVITE]: AuditSeverity.MEDIUM,
            [AuditAction.USER_ACTIVATE]: AuditSeverity.MEDIUM,
            [AuditAction.USER_DEACTIVATE]: AuditSeverity.HIGH,
            [AuditAction.ROLE_CREATE]: AuditSeverity.MEDIUM,
            [AuditAction.ROLE_UPDATE]: AuditSeverity.MEDIUM,
            [AuditAction.ROLE_DELETE]: AuditSeverity.HIGH,
            [AuditAction.ROLE_ASSIGN]: AuditSeverity.MEDIUM,
            [AuditAction.ROLE_REVOKE]: AuditSeverity.HIGH,
            [AuditAction.PROJECT_CREATE]: AuditSeverity.LOW,
            [AuditAction.PROJECT_UPDATE]: AuditSeverity.LOW,
            [AuditAction.PROJECT_DELETE]: AuditSeverity.HIGH,
            [AuditAction.PROJECT_EXPORT]: AuditSeverity.LOW,
            [AuditAction.SEED_CREATE]: AuditSeverity.LOW,
            [AuditAction.SEED_UPDATE]: AuditSeverity.LOW,
            [AuditAction.SEED_DELETE]: AuditSeverity.MEDIUM,
            [AuditAction.SEED_EXPAND]: AuditSeverity.LOW,
            [AuditAction.KEYWORD_UPDATE]: AuditSeverity.LOW,
            [AuditAction.KEYWORD_EXPORT]: AuditSeverity.LOW,
            [AuditAction.KEYWORD_CLUSTER]: AuditSeverity.LOW,
            [AuditAction.BRIEF_CREATE]: AuditSeverity.LOW,
            [AuditAction.BRIEF_UPDATE]: AuditSeverity.LOW,
            [AuditAction.BRIEF_DELETE]: AuditSeverity.MEDIUM,
            [AuditAction.BRIEF_EXPORT]: AuditSeverity.LOW,
            [AuditAction.API_KEY_CREATE]: AuditSeverity.MEDIUM,
            [AuditAction.API_KEY_REVOKE]: AuditSeverity.HIGH,
            [AuditAction.API_CALL]: AuditSeverity.LOW,
            [AuditAction.API_RATE_LIMIT]: AuditSeverity.MEDIUM,
            [AuditAction.BILLING_UPDATE]: AuditSeverity.MEDIUM,
            [AuditAction.PLAN_CHANGE]: AuditSeverity.MEDIUM,
            [AuditAction.PAYMENT_PROCESS]: AuditSeverity.MEDIUM,
            [AuditAction.INVOICE_GENERATE]: AuditSeverity.LOW,
            [AuditAction.SYSTEM_CONFIG_UPDATE]: AuditSeverity.HIGH,
            [AuditAction.BACKUP_CREATE]: AuditSeverity.MEDIUM,
            [AuditAction.BACKUP_RESTORE]: AuditSeverity.HIGH,
            [AuditAction.MAINTENANCE_MODE]: AuditSeverity.HIGH,
            [AuditAction.SUSPICIOUS_ACTIVITY]: AuditSeverity.HIGH,
            [AuditAction.IP_BLOCK]: AuditSeverity.HIGH,
            [AuditAction.IP_UNBLOCK]: AuditSeverity.MEDIUM,
            [AuditAction.SESSION_TERMINATE]: AuditSeverity.MEDIUM,
            [AuditAction.DATA_EXPORT]: AuditSeverity.MEDIUM,
            [AuditAction.DATA_IMPORT]: AuditSeverity.MEDIUM,
            [AuditAction.DATA_DELETE]: AuditSeverity.HIGH,
            [AuditAction.DATA_ANONYMIZE]: AuditSeverity.HIGH,
        };

        return severityMap[action] || AuditSeverity.LOW;
    }

    private getSecuritySeverity(action: string, threatLevel?: string): AuditSeverity {
        if (threatLevel === 'critical') return AuditSeverity.CRITICAL;
        if (threatLevel === 'high') return AuditSeverity.HIGH;
        if (threatLevel === 'medium') return AuditSeverity.MEDIUM;
        if (action === 'suspicious_activity') return AuditSeverity.HIGH;
        if (action === 'ip_block') return AuditSeverity.HIGH;
        return AuditSeverity.MEDIUM;
    }

    private getClientIp(req: Request): string {
        return req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            (req.connection as any).socket?.remoteAddress ||
            'unknown';
    }

    private getAuthDescription(action: string, details?: any): string {
        switch (action) {
            case 'login':
                return `User logged in successfully${details?.mfaUsed ? ' with MFA' : ''}`;
            case 'logout':
                return `User logged out${details?.sessionDuration ? ` (session duration: ${details.sessionDuration}s)` : ''}`;
            case 'login_failed':
                return `Failed login attempt${details?.failureReason ? ` - ${details.failureReason}` : ''}`;
            case 'password_change':
                return 'User changed password';
            case 'password_reset':
                return 'Password reset requested';
            default:
                return `Authentication action: ${action}`;
        }
    }

    private getUserManagementDescription(action: string, details?: any): string {
        switch (action) {
            case 'create':
                return `User created${details?.targetUserId ? `: ${details.targetUserId}` : ''}`;
            case 'update':
                return `User updated${details?.changes ? ` - ${Object.keys(details.changes).join(', ')}` : ''}`;
            case 'delete':
                return `User deleted${details?.reason ? ` - ${details.reason}` : ''}`;
            case 'invite':
                return `User invited${details?.targetUserId ? `: ${details.targetUserId}` : ''}`;
            case 'activate':
                return `User activated${details?.targetUserId ? `: ${details.targetUserId}` : ''}`;
            case 'deactivate':
                return `User deactivated${details?.reason ? ` - ${details.reason}` : ''}`;
            default:
                return `User management action: ${action}`;
        }
    }

    private getRoleManagementDescription(action: string, details?: any): string {
        switch (action) {
            case 'create':
                return `Role created: ${details?.roleName || 'Unknown'}`;
            case 'update':
                return `Role updated: ${details?.roleName || 'Unknown'}`;
            case 'delete':
                return `Role deleted: ${details?.roleName || 'Unknown'}`;
            case 'assign':
                return `Role assigned to user: ${details?.roleName || 'Unknown'}`;
            case 'revoke':
                return `Role revoked from user: ${details?.roleName || 'Unknown'}`;
            default:
                return `Role management action: ${action}`;
        }
    }

    private getProjectDescription(action: string, details?: any): string {
        switch (action) {
            case 'create':
                return `Project created: ${details?.projectName || 'Unknown'}`;
            case 'update':
                return `Project updated: ${details?.projectName || 'Unknown'}`;
            case 'delete':
                return `Project deleted: ${details?.projectName || 'Unknown'}`;
            case 'export':
                return `Project exported: ${details?.projectName || 'Unknown'} (${details?.exportFormat || 'unknown format'})`;
            default:
                return `Project action: ${action}`;
        }
    }

    private getDataDescription(action: string, details?: any): string {
        switch (action) {
            case 'export':
                return `Data exported (${details?.format || 'unknown format'})${details?.recordCount ? ` - ${details.recordCount} records` : ''}`;
            case 'import':
                return `Data imported (${details?.format || 'unknown format'})${details?.recordCount ? ` - ${details.recordCount} records` : ''}`;
            case 'delete':
                return `Data deleted${details?.reason ? ` - ${details.reason}` : ''}`;
            case 'anonymize':
                return `Data anonymized${details?.reason ? ` - ${details.reason}` : ''}`;
            default:
                return `Data action: ${action}`;
        }
    }

    private getApiDescription(action: string, details?: any): string {
        switch (action) {
            case 'call':
                return `API call to ${details?.endpoint || 'unknown endpoint'}`;
            case 'rate_limit':
                return `API rate limit exceeded for ${details?.endpoint || 'unknown endpoint'}`;
            default:
                return `API action: ${action}`;
        }
    }

    private getSecurityDescription(action: string, details?: any): string {
        switch (action) {
            case 'suspicious_activity':
                return `Suspicious activity detected${details?.reason ? ` - ${details.reason}` : ''}`;
            case 'ip_block':
                return `IP address blocked: ${details?.ipAddress || 'unknown'}`;
            case 'ip_unblock':
                return `IP address unblocked: ${details?.ipAddress || 'unknown'}`;
            case 'session_terminate':
                return `Session terminated${details?.sessionId ? `: ${details.sessionId}` : ''}`;
            default:
                return `Security action: ${action}`;
        }
    }
}
