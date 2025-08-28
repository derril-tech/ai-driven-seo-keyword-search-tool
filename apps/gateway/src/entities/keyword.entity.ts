import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Project } from './project.entity';
import { Seed } from './seed.entity';
import { SerpResult } from './serp-result.entity';
import { IntentScore } from './intent-score.entity';

@Entity('keywords')
export class Keyword {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    projectId: string;

    @Column({ nullable: true })
    seedId: string;

    @Column()
    keyword: string;

    @Column({ nullable: true })
    searchVolume: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
    difficultyScore: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
    trafficPotential: number;

    @Column({ nullable: true })
    intentType: string;

    @Column({ type: 'jsonb', default: [] })
    serpFeatures: string[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Project, project => project.keywords)
    @JoinColumn({ name: 'projectId' })
    project: Project;

    @ManyToOne(() => Seed, seed => seed.keywords)
    @JoinColumn({ name: 'seedId' })
    seed: Seed;

    @OneToMany(() => SerpResult, serpResult => serpResult.keyword)
    serpResults: SerpResult[];

    @OneToMany(() => IntentScore, intentScore => intentScore.keyword)
    intentScores: IntentScore[];
}
