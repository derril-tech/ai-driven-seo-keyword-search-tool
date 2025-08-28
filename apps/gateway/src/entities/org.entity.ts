import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, Index } from 'typeorm';
import { User } from './user.entity';
import { Project } from './project.entity';
import { Tenant } from './tenant.entity';

@Entity('orgs')
@Index(['tenant_id', 'name'])
export class Org {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 50, default: 'active' })
    status: 'active' | 'inactive' | 'suspended';

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'jsonb', nullable: true })
    settings: {
        branding?: {
            logo_url?: string;
            primary_color?: string;
        };
        features?: {
            advanced_analytics?: boolean;
            custom_integrations?: boolean;
        };
    };

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    // Relations
    @ManyToOne(() => Tenant, tenant => tenant.orgs)
    tenant: Tenant;

    @OneToMany(() => User, user => user.org)
    users: User[];

    @OneToMany(() => Project, project => project.org)
    projects: Project[];
}
