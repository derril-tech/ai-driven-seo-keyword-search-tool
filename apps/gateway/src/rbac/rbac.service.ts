import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, Permission, RoleType } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import { User } from '../entities/user.entity';
import { Tenant } from '../entities/tenant.entity';

export interface UserPermissions {
    userId: string;
    tenantId: string;
    orgId: string;
    permissions: Permission[];
    roles: string[];
    isOwner: boolean;
    isAdmin: boolean;
}

@Injectable()
export class RbacService {
    private readonly logger = new Logger(RbacService.name);

    constructor(
        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
        @InjectRepository(UserRole)
        private readonly userRoleRepository: Repository<UserRole>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Tenant)
        private readonly tenantRepository: Repository<Tenant>,
    ) { }

    async getUserPermissions(userId: string, tenantId: string, orgId: string): Promise<UserPermissions> {
        try {
            // Get user with roles
            const user = await this.userRepository.findOne({
                where: { id: userId, tenant_id: tenantId },
                relations: ['userRoles', 'userRoles.role'],
            });

            if (!user) {
                throw new ForbiddenException('User not found');
            }

            // Get all active roles for the user in the specific org
            const userRoles = await this.userRoleRepository.find({
                where: {
                    user_id: userId,
                    tenant_id: tenantId,
                    org_id: orgId,
                    is_active: true,
                },
                relations: ['role'],
            });

            // Filter out expired roles
            const activeRoles = userRoles.filter(ur =>
                !ur.expires_at || ur.expires_at > new Date()
            );

            // Collect all permissions from active roles
            const permissions = new Set<Permission>();
            const roleNames: string[] = [];

            for (const userRole of activeRoles) {
                if (userRole.role && userRole.role.is_active) {
                    roleNames.push(userRole.role.name);
                    userRole.role.permissions.forEach(permission => {
                        permissions.add(permission);
                    });
                }
            }

            return {
                userId,
                tenantId,
                orgId,
                permissions: Array.from(permissions),
                roles: roleNames,
                isOwner: user.is_owner,
                isAdmin: user.is_admin,
            };
        } catch (error) {
            this.logger.error(`Error getting user permissions: ${error.message}`);
            throw error;
        }
    }

    async hasPermission(
        userId: string,
        tenantId: string,
        orgId: string,
        requiredPermission: Permission
    ): Promise<boolean> {
        try {
            const userPermissions = await this.getUserPermissions(userId, tenantId, orgId);

            // Owner has all permissions
            if (userPermissions.isOwner) {
                return true;
            }

            // Admin has most permissions (except system-level ones)
            if (userPermissions.isAdmin && !requiredPermission.startsWith('system:')) {
                return true;
            }

            return userPermissions.permissions.includes(requiredPermission);
        } catch (error) {
            this.logger.error(`Error checking permission: ${error.message}`);
            return false;
        }
    }

    async hasAnyPermission(
        userId: string,
        tenantId: string,
        orgId: string,
        requiredPermissions: Permission[]
    ): Promise<boolean> {
        try {
            const userPermissions = await this.getUserPermissions(userId, tenantId, orgId);

            // Owner has all permissions
            if (userPermissions.isOwner) {
                return true;
            }

            // Admin has most permissions (except system-level ones)
            if (userPermissions.isAdmin) {
                const hasSystemPermission = requiredPermissions.some(p => p.startsWith('system:'));
                if (!hasSystemPermission) {
                    return true;
                }
            }

            return requiredPermissions.some(permission =>
                userPermissions.permissions.includes(permission)
            );
        } catch (error) {
            this.logger.error(`Error checking permissions: ${error.message}`);
            return false;
        }
    }

    async hasAllPermissions(
        userId: string,
        tenantId: string,
        orgId: string,
        requiredPermissions: Permission[]
    ): Promise<boolean> {
        try {
            const userPermissions = await this.getUserPermissions(userId, tenantId, orgId);

            // Owner has all permissions
            if (userPermissions.isOwner) {
                return true;
            }

            // Admin has most permissions (except system-level ones)
            if (userPermissions.isAdmin) {
                const hasSystemPermission = requiredPermissions.some(p => p.startsWith('system:'));
                if (!hasSystemPermission) {
                    return true;
                }
            }

            return requiredPermissions.every(permission =>
                userPermissions.permissions.includes(permission)
            );
        } catch (error) {
            this.logger.error(`Error checking permissions: ${error.message}`);
            return false;
        }
    }

    async canAccessResource(
        userId: string,
        tenantId: string,
        orgId: string,
        resourceType: string,
        resourceId: string,
        action: 'read' | 'write' | 'delete'
    ): Promise<boolean> {
        try {
            const permission = `${resourceType}:${action}` as Permission;
            return await this.hasPermission(userId, tenantId, orgId, permission);
        } catch (error) {
            this.logger.error(`Error checking resource access: ${error.message}`);
            return false;
        }
    }

    async assignRoleToUser(
        userId: string,
        roleId: string,
        orgId: string,
        tenantId: string,
        grantedBy: string,
        expiresAt?: Date,
        notes?: string
    ): Promise<UserRole> {
        try {
            // Check if the grantor has permission to assign roles
            const canAssign = await this.hasPermission(
                grantedBy,
                tenantId,
                orgId,
                Permission.ROLE_CREATE
            );

            if (!canAssign) {
                throw new ForbiddenException('Insufficient permissions to assign roles');
            }

            // Check if role exists and belongs to the tenant
            const role = await this.roleRepository.findOne({
                where: { id: roleId, tenant_id: tenantId }
            });

            if (!role) {
                throw new ForbiddenException('Role not found');
            }

            // Check if user already has this role
            const existingUserRole = await this.userRoleRepository.findOne({
                where: { user_id: userId, role_id: roleId, org_id: orgId }
            });

            if (existingUserRole) {
                throw new ForbiddenException('User already has this role');
            }

            // Create new user role
            const userRole = this.userRoleRepository.create({
                user_id: userId,
                role_id: roleId,
                org_id: orgId,
                tenant_id: tenantId,
                granted_by: grantedBy,
                expires_at: expiresAt,
                notes,
                is_active: true,
            });

            return await this.userRoleRepository.save(userRole);
        } catch (error) {
            this.logger.error(`Error assigning role to user: ${error.message}`);
            throw error;
        }
    }

    async revokeRoleFromUser(
        userId: string,
        roleId: string,
        orgId: string,
        tenantId: string,
        revokedBy: string
    ): Promise<void> {
        try {
            // Check if the revoker has permission to revoke roles
            const canRevoke = await this.hasPermission(
                revokedBy,
                tenantId,
                orgId,
                Permission.ROLE_DELETE
            );

            if (!canRevoke) {
                throw new ForbiddenException('Insufficient permissions to revoke roles');
            }

            // Find and deactivate the user role
            const userRole = await this.userRoleRepository.findOne({
                where: { user_id: userId, role_id: roleId, org_id: orgId }
            });

            if (!userRole) {
                throw new ForbiddenException('User role not found');
            }

            userRole.is_active = false;
            await this.userRoleRepository.save(userRole);
        } catch (error) {
            this.logger.error(`Error revoking role from user: ${error.message}`);
            throw error;
        }
    }

    async createRole(
        name: string,
        description: string,
        permissions: Permission[],
        tenantId: string,
        createdBy: string,
        type: RoleType = RoleType.VIEWER,
        isSystem: boolean = false
    ): Promise<Role> {
        try {
            // Check if creator has permission to create roles
            const canCreate = await this.hasPermission(
                createdBy,
                tenantId,
                '', // orgId not needed for role creation
                Permission.ROLE_CREATE
            );

            if (!canCreate) {
                throw new ForbiddenException('Insufficient permissions to create roles');
            }

            // Check if role name already exists in tenant
            const existingRole = await this.roleRepository.findOne({
                where: { name, tenant_id: tenantId }
            });

            if (existingRole) {
                throw new ForbiddenException('Role name already exists');
            }

            const role = this.roleRepository.create({
                name,
                description,
                permissions,
                tenant_id: tenantId,
                created_by: createdBy,
                type,
                is_system: isSystem,
                is_active: true,
            });

            return await this.roleRepository.save(role);
        } catch (error) {
            this.logger.error(`Error creating role: ${error.message}`);
            throw error;
        }
    }

    async updateRole(
        roleId: string,
        updates: Partial<Role>,
        tenantId: string,
        updatedBy: string
    ): Promise<Role> {
        try {
            // Check if updater has permission to update roles
            const canUpdate = await this.hasPermission(
                updatedBy,
                tenantId,
                '', // orgId not needed for role updates
                Permission.ROLE_UPDATE
            );

            if (!canUpdate) {
                throw new ForbiddenException('Insufficient permissions to update roles');
            }

            const role = await this.roleRepository.findOne({
                where: { id: roleId, tenant_id: tenantId }
            });

            if (!role) {
                throw new ForbiddenException('Role not found');
            }

            // Don't allow updating system roles
            if (role.is_system) {
                throw new ForbiddenException('Cannot update system roles');
            }

            Object.assign(role, updates);
            return await this.roleRepository.save(role);
        } catch (error) {
            this.logger.error(`Error updating role: ${error.message}`);
            throw error;
        }
    }

    async deleteRole(
        roleId: string,
        tenantId: string,
        deletedBy: string
    ): Promise<void> {
        try {
            // Check if deleter has permission to delete roles
            const canDelete = await this.hasPermission(
                deletedBy,
                tenantId,
                '', // orgId not needed for role deletion
                Permission.ROLE_DELETE
            );

            if (!canDelete) {
                throw new ForbiddenException('Insufficient permissions to delete roles');
            }

            const role = await this.roleRepository.findOne({
                where: { id: roleId, tenant_id: tenantId }
            });

            if (!role) {
                throw new ForbiddenException('Role not found');
            }

            // Don't allow deleting system roles
            if (role.is_system) {
                throw new ForbiddenException('Cannot delete system roles');
            }

            // Check if role is assigned to any users
            const userRoles = await this.userRoleRepository.find({
                where: { role_id: roleId, is_active: true }
            });

            if (userRoles.length > 0) {
                throw new ForbiddenException('Cannot delete role that is assigned to users');
            }

            await this.roleRepository.remove(role);
        } catch (error) {
            this.logger.error(`Error deleting role: ${error.message}`);
            throw error;
        }
    }

    async getDefaultRoles(tenantId: string): Promise<Role[]> {
        try {
            return await this.roleRepository.find({
                where: { tenant_id: tenantId, is_system: true }
            });
        } catch (error) {
            this.logger.error(`Error getting default roles: ${error.message}`);
            return [];
        }
    }

    async createDefaultRoles(tenantId: string, createdBy: string): Promise<void> {
        try {
            const defaultRoles = [
                {
                    name: 'Owner',
                    description: 'Full access to all features and settings',
                    type: RoleType.OWNER,
                    permissions: Object.values(Permission),
                },
                {
                    name: 'Admin',
                    description: 'Administrative access to most features',
                    type: RoleType.ADMIN,
                    permissions: Object.values(Permission).filter(p => !p.startsWith('system:')),
                },
                {
                    name: 'Manager',
                    description: 'Can manage projects and team members',
                    type: RoleType.MANAGER,
                    permissions: [
                        Permission.PROJECT_CREATE,
                        Permission.PROJECT_READ,
                        Permission.PROJECT_UPDATE,
                        Permission.PROJECT_EXPORT,
                        Permission.SEED_CREATE,
                        Permission.SEED_READ,
                        Permission.SEED_UPDATE,
                        Permission.KEYWORD_READ,
                        Permission.KEYWORD_UPDATE,
                        Permission.KEYWORD_EXPORT,
                        Permission.CLUSTER_READ,
                        Permission.CLUSTER_UPDATE,
                        Permission.CLUSTER_EXPORT,
                        Permission.BRIEF_CREATE,
                        Permission.BRIEF_READ,
                        Permission.BRIEF_UPDATE,
                        Permission.USER_READ,
                        Permission.ANALYTICS_READ,
                        Permission.ANALYTICS_EXPORT,
                    ],
                },
                {
                    name: 'Editor',
                    description: 'Can edit projects and content',
                    type: RoleType.EDITOR,
                    permissions: [
                        Permission.PROJECT_READ,
                        Permission.PROJECT_UPDATE,
                        Permission.SEED_CREATE,
                        Permission.SEED_READ,
                        Permission.SEED_UPDATE,
                        Permission.KEYWORD_READ,
                        Permission.KEYWORD_UPDATE,
                        Permission.CLUSTER_READ,
                        Permission.CLUSTER_UPDATE,
                        Permission.BRIEF_CREATE,
                        Permission.BRIEF_READ,
                        Permission.BRIEF_UPDATE,
                        Permission.ANALYTICS_READ,
                    ],
                },
                {
                    name: 'Viewer',
                    description: 'Read-only access to projects',
                    type: RoleType.VIEWER,
                    permissions: [
                        Permission.PROJECT_READ,
                        Permission.SEED_READ,
                        Permission.KEYWORD_READ,
                        Permission.CLUSTER_READ,
                        Permission.BRIEF_READ,
                        Permission.ANALYTICS_READ,
                    ],
                },
            ];

            for (const roleData of defaultRoles) {
                await this.createRole(
                    roleData.name,
                    roleData.description,
                    roleData.permissions,
                    tenantId,
                    createdBy,
                    roleData.type,
                    true // isSystem
                );
            }
        } catch (error) {
            this.logger.error(`Error creating default roles: ${error.message}`);
            throw error;
        }
    }
}
