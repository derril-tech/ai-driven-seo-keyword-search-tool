import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './project.entity';
import { Cluster } from './cluster.entity';

@Entity('briefs')
export class Brief {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    projectId: string;

    @Column({ nullable: true })
    clusterId: string;

    @Column()
    title: string;

    @Column({ type: 'jsonb', default: [] })
    outline: any[];

    @Column({ type: 'jsonb', default: [] })
    faqs: any[];

    @Column({ type: 'jsonb', default: [] })
    entities: any[];

    @Column({ type: 'jsonb', default: [] })
    internalLinks: any[];

    @Column({ type: 'jsonb', default: {} })
    metaSuggestions: Record<string, any>;

    @Column({ default: 'draft' })
    status: string;

    @Column({ nullable: true })
    createdBy: string;

    @Column({ nullable: true })
    approvedBy: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Project, project => project.briefs)
    @JoinColumn({ name: 'projectId' })
    project: Project;

    @ManyToOne(() => Cluster, cluster => cluster.briefs)
    @JoinColumn({ name: 'clusterId' })
    cluster: Cluster;
}
