import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Project } from './project.entity';
import { Keyword } from './keyword.entity';

@Entity('seeds')
export class Seed {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    projectId: string;

    @Column()
    keyword: string;

    @Column({ nullable: true })
    url: string;

    @Column({ nullable: true })
    domain: string;

    @Column({ default: 'keyword' })
    seedType: string;

    @Column({ default: 'pending' })
    status: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Project, project => project.seeds)
    @JoinColumn({ name: 'projectId' })
    project: Project;

    @OneToMany(() => Keyword, keyword => keyword.seed)
    keywords: Keyword[];
}
