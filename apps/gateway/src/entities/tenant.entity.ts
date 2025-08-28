import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Org } from './org.entity';
import { User } from './user.entity';
import { Project } from './project.entity';

@Entity('tenants')
@Index(['subdomain'], { unique: true })
@Index(['domain'], { unique: true, where: '"domain" IS NOT NULL' })
export class Tenant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 100, unique: true })
    name: string;

    @Column({ type: 'varchar', length: 100, unique: true })
    subdomain: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    domain: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 50, default: 'active' })
    status: 'active' | 'suspended' | 'pending' | 'cancelled';

    @Column({ type: 'varchar', length: 50, default: 'standard' })
    plan: 'standard' | 'professional' | 'enterprise' | 'custom';

    @Column({ type: 'jsonb', nullable: true })
    settings: {
        branding?: {
            logo_url?: string;
            primary_color?: string;
            company_name?: string;
        };
        features?: {
            advanced_clustering?: boolean;
            competitor_analysis?: boolean;
            white_label?: boolean;
            api_access?: boolean;
            custom_integrations?: boolean;
        };
        limits?: {
            max_projects?: number;
            max_seeds_per_project?: number;
            max_users?: number;
            api_rate_limit?: number;
        };
        integrations?: {
            webhooks_enabled?: boolean;
            sso_enabled?: boolean;
            custom_domain?: boolean;
        };
    };

    @Column({ type: 'jsonb', nullable: true })
    metadata: {
        industry?: string;
        company_size?: string;
        region?: string;
        created_by?: string;
        sales_contact?: string;
    };

    @Column({ type: 'timestamp', nullable: true })
    trial_ends_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    subscription_ends_at: Date;

    @Column({ type: 'boolean', default: false })
    is_whitelabel: boolean;

    @Column({ type: 'boolean', default: false })
    is_enterprise: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    // Relations
    @OneToMany(() => Org, org => org.tenant)
    orgs: Org[];

    @OneToMany(() => User, user => user.tenant)
    users: User[];

    @OneToMany(() => Project, project => project.tenant)
    projects: Project[];
}
