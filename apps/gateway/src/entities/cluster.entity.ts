import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Project } from './project.entity';
import { ClusterMember } from './cluster-member.entity';
import { Brief } from './brief.entity';

@Entity('clusters')
export class Cluster {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    projectId: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    label: string;

    @Column({ nullable: true })
    description: string;

    @Column({ default: 0 })
    keywordsCount: number;

    @Column({ type: 'vector', dimension: 768, nullable: true })
    centroid: number[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Project, project => project.clusters)
    @JoinColumn({ name: 'projectId' })
    project: Project;

    @OneToMany(() => ClusterMember, clusterMember => clusterMember.cluster)
    clusterMembers: ClusterMember[];

    @OneToMany(() => Brief, brief => brief.cluster)
    briefs: Brief[];
}
