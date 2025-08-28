import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './project.entity';

@Entity('exports')
export class Export {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    projectId: string;

    @Column()
    userId: string;

    @Column()
    exportType: string;

    @Column({ nullable: true })
    filePath: string;

    @Column({ nullable: true })
    fileSize: number;

    @Column({ default: 'pending' })
    status: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ nullable: true })
    completedAt: Date;

    @ManyToOne(() => Project, project => project.exports)
    @JoinColumn({ name: 'projectId' })
    project: Project;
}
