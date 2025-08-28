import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Keyword } from './keyword.entity';

@Entity('intent_scores')
export class IntentScore {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    keywordId: string;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
    informational: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
    commercial: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
    transactional: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
    navigational: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
    local: number;

    @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
    confidence: number;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Keyword, keyword => keyword.intentScores)
    @JoinColumn({ name: 'keywordId' })
    keyword: Keyword;
}
