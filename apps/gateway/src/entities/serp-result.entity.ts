import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Keyword } from './keyword.entity';

@Entity('serp_results')
export class SerpResult {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    keywordId: string;

    @Column()
    position: number;

    @Column({ nullable: true })
    title: string;

    @Column()
    url: string;

    @Column({ nullable: true })
    snippet: string;

    @Column({ nullable: true })
    domain: string;

    @Column({ type: 'jsonb', default: [] })
    features: string[];

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Keyword, keyword => keyword.serpResults)
    @JoinColumn({ name: 'keywordId' })
    keyword: Keyword;
}
