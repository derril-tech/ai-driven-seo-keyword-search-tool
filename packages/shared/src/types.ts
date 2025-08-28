export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    settings?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    settings?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface Project {
    id: string;
    orgId: string;
    name: string;
    description?: string;
    settings?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface Seed {
    id: string;
    projectId: string;
    keyword: string;
    url?: string;
    domain?: string;
    seedType: 'keyword' | 'url' | 'domain';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: string;
    updatedAt: string;
}

export interface Keyword {
    id: string;
    projectId: string;
    seedId?: string;
    keyword: string;
    searchVolume?: number;
    difficultyScore?: number;
    trafficPotential?: number;
    intentType?: 'informational' | 'commercial' | 'transactional' | 'navigational' | 'local';
    serpFeatures?: string[];
    createdAt: string;
    updatedAt: string;
}

export interface SerpResult {
    id: string;
    keywordId: string;
    position: number;
    title?: string;
    url: string;
    snippet?: string;
    domain?: string;
    features?: string[];
    createdAt: string;
}

export interface Cluster {
    id: string;
    projectId: string;
    name: string;
    label?: string;
    description?: string;
    keywordsCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface Brief {
    id: string;
    projectId: string;
    clusterId?: string;
    title: string;
    outline?: any[];
    faqs?: any[];
    entities?: any[];
    internalLinks?: any[];
    metaSuggestions?: Record<string, any>;
    status: 'draft' | 'approved' | 'published';
    createdBy?: string;
    approvedBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Export {
    id: string;
    projectId: string;
    userId: string;
    exportType: 'csv' | 'xlsx' | 'pdf' | 'json';
    filePath?: string;
    fileSize?: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: string;
    completedAt?: string;
}
