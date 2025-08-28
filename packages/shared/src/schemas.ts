import { z } from 'zod';

export const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    avatarUrl: z.string().url().optional(),
    settings: z.record(z.any()).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const OrganizationSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(100),
    settings: z.record(z.any()).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const ProjectSchema = z.object({
    id: z.string().uuid(),
    orgId: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    settings: z.record(z.any()).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const SeedSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    keyword: z.string().min(1).max(500),
    url: z.string().url().optional(),
    domain: z.string().max(255).optional(),
    seedType: z.enum(['keyword', 'url', 'domain']).default('keyword'),
    status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const KeywordSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    seedId: z.string().uuid().optional(),
    keyword: z.string().min(1).max(500),
    searchVolume: z.number().int().positive().optional(),
    difficultyScore: z.number().min(0).max(1).optional(),
    trafficPotential: z.number().min(0).max(1).optional(),
    intentType: z.enum(['informational', 'commercial', 'transactional', 'navigational', 'local']).optional(),
    serpFeatures: z.array(z.string()).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const SerpResultSchema = z.object({
    id: z.string().uuid(),
    keywordId: z.string().uuid(),
    position: z.number().int().positive(),
    title: z.string().max(500).optional(),
    url: z.string().url(),
    snippet: z.string().optional(),
    domain: z.string().max(255).optional(),
    features: z.array(z.string()).optional(),
    createdAt: z.string().datetime(),
});

export const ClusterSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    name: z.string().min(1).max(255),
    label: z.string().max(255).optional(),
    description: z.string().optional(),
    keywordsCount: z.number().int().min(0).default(0),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const BriefSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    clusterId: z.string().uuid().optional(),
    title: z.string().min(1).max(500),
    outline: z.array(z.any()).optional(),
    faqs: z.array(z.any()).optional(),
    entities: z.array(z.any()).optional(),
    internalLinks: z.array(z.any()).optional(),
    metaSuggestions: z.record(z.any()).optional(),
    status: z.enum(['draft', 'approved', 'published']).default('draft'),
    createdBy: z.string().uuid().optional(),
    approvedBy: z.string().uuid().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export const ExportSchema = z.object({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    exportType: z.enum(['csv', 'xlsx', 'pdf', 'json']),
    filePath: z.string().optional(),
    fileSize: z.number().int().positive().optional(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
});
