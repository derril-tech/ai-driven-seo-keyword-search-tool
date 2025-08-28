import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Membership } from './membership.entity';
import { Project } from './project.entity';

@Entity('orgs')
export class Organization {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    slug: string;

    @Column({ type: 'jsonb', default: {} })
    settings: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => Membership, membership => membership.organization)
    memberships: Membership[];

    @OneToMany(() => Project, project => project.organization)
    projects: Project[];
}
