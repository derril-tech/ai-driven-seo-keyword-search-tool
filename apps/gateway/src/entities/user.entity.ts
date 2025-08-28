import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { Org } from './org.entity';
import { Project } from './project.entity';
import { Tenant } from './tenant.entity';
import { UserRole } from './user-role.entity';

@Entity('users')
@Index(['email'], { unique: true })
@Index(['tenant_id', 'email'])
@Index(['org_id', 'status'])
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    email: string;

    @Column({ type: 'varchar', length: 255 })
    password_hash: string;

    @Column({ type: 'varchar', length: 100 })
    first_name: string;

    @Column({ type: 'varchar', length: 100 })
    last_name: string;

    @Column({ type: 'varchar', length: 50, default: 'active' })
    status: 'active' | 'inactive' | 'suspended' | 'pending';

    @Column({ type: 'uuid' })
    org_id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    job_title: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    department: string;

    @Column({ type: 'boolean', default: false })
    is_owner: boolean;

    @Column({ type: 'boolean', default: false })
    is_admin: boolean;

    @Column({ type: 'boolean', default: false })
    mfa_enabled: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true })
    mfa_secret: string;

    @Column({ type: 'timestamp', nullable: true })
    last_login_at: Date;

    @Column({ type: 'varchar', length: 45, nullable: true })
    last_login_ip: string;

    @Column({ type: 'jsonb', nullable: true })
    preferences: {
        theme?: 'light' | 'dark' | 'auto';
        language?: string;
        timezone?: string;
        notifications?: {
            email?: boolean;
            push?: boolean;
            sms?: boolean;
        };
    };

    @Column({ type: 'timestamp', nullable: true })
    email_verified_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    password_changed_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    account_locked_until: Date;

    @Column({ type: 'integer', default: 0 })
    failed_login_attempts: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    // Relations
    @ManyToOne(() => Org, org => org.users)
    org: Org;

    @ManyToOne(() => Tenant, tenant => tenant.users)
    tenant: Tenant;

    @OneToMany(() => Project, project => project.created_by_user)
    created_projects: Project[];

    @OneToMany(() => UserRole, userRole => userRole.user)
    userRoles: UserRole[];
}
