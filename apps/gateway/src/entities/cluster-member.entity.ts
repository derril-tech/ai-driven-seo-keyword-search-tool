import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Cluster } from './cluster.entity';
import { Keyword } from './keyword.entity';

@Entity('cluster_members')
export class ClusterMember {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    clusterId: string;

    @Column()
    keywordId: string;

    @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
    similarityScore: number;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Cluster, cluster => cluster.clusterMembers)
    @JoinColumn({ name: 'clusterId' })
    cluster: Cluster;

    @ManyToOne(() => Keyword)
    @JoinColumn({ name: 'keywordId' })
    keyword: Keyword;
}
