import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';

@Entity('user_roles')
@Index(['user_id', 'role_id'], { unique: true })
@Index(['user_id', 'org_id'])
export class UserRole {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    user_id: string;

    @Column({ type: 'uuid' })
    role_id: string;

    @Column({ type: 'uuid' })
    org_id: string;

    @Column({ type: 'uuid' })
    tenant_id: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'timestamp', nullable: true })
    expires_at: Date;

    @Column({ type: 'uuid', nullable: true })
    granted_by: string;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn()
    created_at: Date;

    // Relations
    @ManyToOne(() => User, user => user.userRoles)
    user: User;

    @ManyToOne(() => Role, role => role.userRoles)
    role: Role;
}
