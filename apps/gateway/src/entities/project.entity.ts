import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Index } from 'typeorm';
import { Org } from './org.entity';
import { User } from './user.entity';
import { Seed } from './seed.entity';
import { Keyword } from './keyword.entity';
import { Cluster } from './cluster.entity';
import { Brief } from './brief.entity';
import { Export } from './export.entity';
import { Tenant } from './tenant.entity';

@Entity('projects')
@Index(['tenant_id', 'org_id'])
@Index(['created_by', 'status'])
export class Project {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'varchar', length: 50, default: 'active' })
    status: 'active' | 'archived' | 'deleted';

    @Column({ type: 'uuid' })
    org_id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'uuid' })
    created_by: string;

    @Column({ type: 'jsonb', nullable: true })
    settings: {
        language?: string;
        country?: string;
        search_engine?: string;
        max_keywords?: number;
        clustering_enabled?: boolean;
        competitor_analysis?: boolean;
    };

    @Column({ type: 'jsonb', nullable: true })
    metadata: {
        industry?: string;
        target_audience?: string;
        competitors?: string[];
        goals?: string[];
    };

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    // Relations
    @ManyToOne(() => Org, org => org.projects)
    org: Org;

    @ManyToOne(() => Tenant, tenant => tenant.projects)
    tenant: Tenant;

    @ManyToOne(() => User, user => user.created_projects)
    created_by_user: User;

    @OneToMany(() => Seed, seed => seed.project)
    seeds: Seed[];

    @OneToMany(() => Keyword, keyword => keyword.project)
    keywords: Keyword[];

    @OneToMany(() => Cluster, cluster => cluster.project)
    clusters: Cluster[];

    @OneToMany(() => Brief, brief => brief.project)
    briefs: Brief[];

    @OneToMany(() => Export, export_ => export_.project)
    exports: Export[];
}
