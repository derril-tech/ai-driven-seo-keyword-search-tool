import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum AuditAction {
    // Authentication actions
    LOGIN = 'login',
    LOGOUT = 'logout',
    LOGIN_FAILED = 'login_failed',
    PASSWORD_CHANGE = 'password_change',
    PASSWORD_RESET = 'password_reset',
    MFA_ENABLE = 'mfa_enable',
    MFA_DISABLE = 'mfa_disable',

    // User management actions
    USER_CREATE = 'user_create',
    USER_UPDATE = 'user_update',
    USER_DELETE = 'user_delete',
    USER_INVITE = 'user_invite',
    USER_ACTIVATE = 'user_activate',
    USER_DEACTIVATE = 'user_deactivate',

    // Role management actions
    ROLE_CREATE = 'role_create',
    ROLE_UPDATE = 'role_update',
    ROLE_DELETE = 'role_delete',
    ROLE_ASSIGN = 'role_assign',
    ROLE_REVOKE = 'role_revoke',

    // Project actions
    PROJECT_CREATE = 'project_create',
    PROJECT_UPDATE = 'project_update',
    PROJECT_DELETE = 'project_delete',
    PROJECT_EXPORT = 'project_export',

    // Seed actions
    SEED_CREATE = 'seed_create',
    SEED_UPDATE = 'seed_update',
    SEED_DELETE = 'seed_delete',
    SEED_EXPAND = 'seed_expand',

    // Keyword actions
    KEYWORD_UPDATE = 'keyword_update',
    KEYWORD_EXPORT = 'keyword_export',
    KEYWORD_CLUSTER = 'keyword_cluster',

    // Brief actions
    BRIEF_CREATE = 'brief_create',
    BRIEF_UPDATE = 'brief_update',
    BRIEF_DELETE = 'brief_delete',
    BRIEF_EXPORT = 'brief_export',

    // API actions
    API_KEY_CREATE = 'api_key_create',
    API_KEY_REVOKE = 'api_key_revoke',
    API_CALL = 'api_call',
    API_RATE_LIMIT = 'api_rate_limit',

    // Billing actions
    BILLING_UPDATE = 'billing_update',
    PLAN_CHANGE = 'plan_change',
    PAYMENT_PROCESS = 'payment_process',
    INVOICE_GENERATE = 'invoice_generate',

    // System actions
    SYSTEM_CONFIG_UPDATE = 'system_config_update',
    BACKUP_CREATE = 'backup_create',
    BACKUP_RESTORE = 'backup_restore',
    MAINTENANCE_MODE = 'maintenance_mode',

    // Security actions
    SUSPICIOUS_ACTIVITY = 'suspicious_activity',
    IP_BLOCK = 'ip_block',
    IP_UNBLOCK = 'ip_unblock',
    SESSION_TERMINATE = 'session_terminate',

    // Data actions
    DATA_EXPORT = 'data_export',
    DATA_IMPORT = 'data_import',
    DATA_DELETE = 'data_delete',
    DATA_ANONYMIZE = 'data_anonymize',
}

export enum AuditSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

@Entity('audit_logs')
@Index(['tenant_id', 'created_at'])
@Index(['user_id', 'created_at'])
@Index(['action', 'created_at'])
@Index(['severity', 'created_at'])
@Index(['ip_address', 'created_at'])
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'uuid', nullable: true })
    user_id: string;

    @Column({ type: 'uuid', nullable: true })
    org_id: string;

    @Column({
        type: 'enum',
        enum: AuditAction
    })
    action: AuditAction;

    @Column({
        type: 'enum',
        enum: AuditSeverity,
        default: AuditSeverity.LOW
    })
    severity: AuditSeverity;

    @Column({ type: 'varchar', length: 255, nullable: true })
    resource_type: string;

    @Column({ type: 'uuid', nullable: true })
    resource_id: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'jsonb', nullable: true })
    details: {
        before?: any;
        after?: any;
        changes?: any;
        metadata?: any;
        context?: any;
    };

    @Column({ type: 'varchar', length: 45, nullable: true })
    ip_address: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    user_agent: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    session_id: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    request_id: string;

    @Column({ type: 'varchar', length: 10, nullable: true })
    http_method: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    endpoint: string;

    @Column({ type: 'integer', nullable: true })
    status_code: number;

    @Column({ type: 'integer', nullable: true })
    response_time: number;

    @Column({ type: 'boolean', default: false })
    is_success: boolean;

    @Column({ type: 'text', nullable: true })
    error_message: string;

    @Column({ type: 'jsonb', nullable: true })
    request_headers: Record<string, string>;

    @Column({ type: 'jsonb', nullable: true })
    response_headers: Record<string, string>;

    @Column({ type: 'varchar', length: 100, nullable: true })
    country: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    city: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    timezone: string;

    @Column({ type: 'boolean', default: false })
    is_automated: boolean;

    @Column({ type: 'boolean', default: false })
    requires_review: boolean;

    @Column({ type: 'uuid', nullable: true })
    reviewed_by: string;

    @Column({ type: 'timestamp', nullable: true })
    reviewed_at: Date;

    @Column({ type: 'text', nullable: true })
    review_notes: string;

    @CreateDateColumn()
    created_at: Date;
}
