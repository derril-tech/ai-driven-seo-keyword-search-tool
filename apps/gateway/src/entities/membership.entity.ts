import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Organization } from './organization.entity';

@Entity('memberships')
export class Membership {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    orgId: string;

    @Column()
    userId: string;

    @Column({ default: 'member' })
    role: string;

    @Column({ type: 'jsonb', default: [] })
    permissions: string[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Organization, organization => organization.memberships)
    @JoinColumn({ name: 'orgId' })
    organization: Organization;

    @ManyToOne(() => User, user => user.memberships)
    @JoinColumn({ name: 'userId' })
    user: User;
}
