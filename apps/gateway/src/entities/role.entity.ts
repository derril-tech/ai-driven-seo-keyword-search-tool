import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { Tenant } from './tenant.entity';
import { UserRole } from './user-role.entity';

export enum Permission {
    // Project permissions
    PROJECT_CREATE = 'project:create',
    PROJECT_READ = 'project:read',
    PROJECT_UPDATE = 'project:update',
    PROJECT_DELETE = 'project:delete',
    PROJECT_EXPORT = 'project:export',

    // Seed permissions
    SEED_CREATE = 'seed:create',
    SEED_READ = 'seed:read',
    SEED_UPDATE = 'seed:update',
    SEED_DELETE = 'seed:delete',

    // Keyword permissions
    KEYWORD_READ = 'keyword:read',
    KEYWORD_UPDATE = 'keyword:update',
    KEYWORD_EXPORT = 'keyword:export',

    // Cluster permissions
    CLUSTER_READ = 'cluster:read',
    CLUSTER_UPDATE = 'cluster:update',
    CLUSTER_EXPORT = 'cluster:export',

    // Brief permissions
    BRIEF_CREATE = 'brief:create',
    BRIEF_READ = 'brief:read',
    BRIEF_UPDATE = 'brief:update',
    BRIEF_DELETE = 'brief:delete',

    // User management permissions
    USER_CREATE = 'user:create',
    USER_READ = 'user:read',
    USER_UPDATE = 'user:update',
    USER_DELETE = 'user:delete',
    USER_INVITE = 'user:invite',

    // Role management permissions
    ROLE_CREATE = 'role:create',
    ROLE_READ = 'role:read',
    ROLE_UPDATE = 'role:update',
    ROLE_DELETE = 'role:delete',

    // Organization permissions
    ORG_READ = 'org:read',
    ORG_UPDATE = 'org:update',
    ORG_DELETE = 'org:delete',

    // Billing permissions
    BILLING_READ = 'billing:read',
    BILLING_UPDATE = 'billing:update',

    // Analytics permissions
    ANALYTICS_READ = 'analytics:read',
    ANALYTICS_EXPORT = 'analytics:export',

    // API permissions
    API_ACCESS = 'api:access',
    API_READ = 'api:read',
    API_WRITE = 'api:write',

    // System permissions
    SYSTEM_ADMIN = 'system:admin',
    SYSTEM_CONFIG = 'system:config',
    SYSTEM_MONITOR = 'system:monitor',
}

export enum RoleType {
    OWNER = 'owner',
    ADMIN = 'admin',
    MANAGER = 'manager',
    EDITOR = 'editor',
    VIEWER = 'viewer',
    GUEST = 'guest',
}

@Entity('roles')
@Index(['tenant_id', 'name'], { unique: true })
export class Role {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({
        type: 'enum',
        enum: RoleType,
        default: RoleType.VIEWER
    })
    type: RoleType;

    @Column({ type: 'boolean', default: false })
    is_system: boolean;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'jsonb', default: [] })
    permissions: Permission[];

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'uuid', nullable: true })
    created_by: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    // Relations
    @ManyToOne(() => Tenant, tenant => tenant.id)
    tenant: Tenant;

    @OneToMany(() => UserRole, userRole => userRole.role)
    userRoles: UserRole[];
}
