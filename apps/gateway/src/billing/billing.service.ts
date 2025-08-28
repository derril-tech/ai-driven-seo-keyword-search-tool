import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Org } from '../entities/org.entity';
import { Project } from '../entities/project.entity';
import { Seed } from '../entities/seed.entity';
import { Keyword } from '../entities/keyword.entity';
import { Export } from '../entities/export.entity';

export interface UsageMetrics {
    seedsToday: number;
    serpCallsToday: number;
    exportsToday: number;
    totalKeywords: number;
    totalClusters: number;
    totalBriefs: number;
}

export interface QuotaLimits {
    seedsPerDay: number;
    serpCallsPerDay: number;
    exportsPerDay: number;
    maxKeywords: number;
    maxClusters: number;
    maxBriefs: number;
}

export interface BillingPlan {
    name: string;
    price: number;
    limits: QuotaLimits;
    features: string[];
}

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);

    private readonly plans: Record<string, BillingPlan> = {
        free: {
            name: 'Free',
            price: 0,
            limits: {
                seedsPerDay: 10,
                serpCallsPerDay: 50,
                exportsPerDay: 5,
                maxKeywords: 1000,
                maxClusters: 50,
                maxBriefs: 10,
            },
            features: ['Basic keyword expansion', 'SERP analysis', 'Basic clustering'],
        },
        starter: {
            name: 'Starter',
            price: 29,
            limits: {
                seedsPerDay: 100,
                serpCallsPerDay: 500,
                exportsPerDay: 25,
                maxKeywords: 10000,
                maxClusters: 200,
                maxBriefs: 100,
            },
            features: [
                'Advanced keyword expansion',
                'SERP analysis',
                'Clustering',
                'Content briefs',
                'Basic exports',
            ],
        },
        professional: {
            name: 'Professional',
            price: 99,
            limits: {
                seedsPerDay: 500,
                serpCallsPerDay: 2500,
                exportsPerDay: 100,
                maxKeywords: 50000,
                maxClusters: 1000,
                maxBriefs: 500,
            },
            features: [
                'Advanced keyword expansion',
                'SERP analysis',
                'Clustering',
                'Content briefs',
                'Advanced exports',
                'Priority support',
            ],
        },
        enterprise: {
            name: 'Enterprise',
            price: 299,
            limits: {
                seedsPerDay: 2000,
                serpCallsPerDay: 10000,
                exportsPerDay: 500,
                maxKeywords: 200000,
                maxClusters: 5000,
                maxBriefs: 2000,
            },
            features: [
                'Advanced keyword expansion',
                'SERP analysis',
                'Clustering',
                'Content briefs',
                'Advanced exports',
                'Priority support',
                'Custom integrations',
                'Dedicated account manager',
            ],
        },
    };

    constructor(
        @InjectRepository(Org)
        private orgRepository: Repository<Org>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(Seed)
        private seedRepository: Repository<Seed>,
        @InjectRepository(Keyword)
        private keywordRepository: Repository<Keyword>,
        @InjectRepository(Export)
        private exportRepository: Repository<Export>,
    ) { }

    async getUsageMetrics(orgId: string): Promise<UsageMetrics> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [seedsToday, serpCallsToday, exportsToday] = await Promise.all([
            this.seedRepository.count({
                where: {
                    project: { org: { id: orgId } },
                    createdAt: { $gte: today } as any,
                },
            }),
            this.keywordRepository
                .createQueryBuilder('keyword')
                .leftJoin('keyword.project', 'project')
                .leftJoin('project.org', 'org')
                .where('org.id = :orgId', { orgId })
                .andWhere('keyword.serpFetchedAt >= :today', { today })
                .getCount(),
            this.exportRepository.count({
                where: {
                    project: { org: { id: orgId } },
                    createdAt: { $gte: today } as any,
                },
            }),
        ]);

        const [totalKeywords, totalClusters, totalBriefs] = await Promise.all([
            this.keywordRepository
                .createQueryBuilder('keyword')
                .leftJoin('keyword.project', 'project')
                .leftJoin('project.org', 'org')
                .where('org.id = :orgId', { orgId })
                .getCount(),
            this.keywordRepository
                .createQueryBuilder('keyword')
                .leftJoin('keyword.project', 'project')
                .leftJoin('project.org', 'org')
                .where('org.id = :orgId', { orgId })
                .andWhere('keyword.clusterId IS NOT NULL')
                .getCount(),
            this.keywordRepository
                .createQueryBuilder('keyword')
                .leftJoin('keyword.project', 'project')
                .leftJoin('project.org', 'org')
                .where('org.id = :orgId', { orgId })
                .andWhere('keyword.briefGeneratedAt IS NOT NULL')
                .getCount(),
        ]);

        return {
            seedsToday,
            serpCallsToday,
            exportsToday,
            totalKeywords,
            totalClusters,
            totalBriefs,
        };
    }

    async getQuotaLimits(orgId: string): Promise<QuotaLimits> {
        const org = await this.orgRepository.findOne({
            where: { id: orgId },
        });

        if (!org) {
            throw new Error('Organization not found');
        }

        const settings = org.settings || {};
        const plan = settings.plan || 'free';
        const customLimits = settings.limits || {};

        const planLimits = this.plans[plan]?.limits || this.plans.free.limits;

        return {
            seedsPerDay: customLimits.seedsPerDay || planLimits.seedsPerDay,
            serpCallsPerDay: customLimits.serpCallsPerDay || planLimits.serpCallsPerDay,
            exportsPerDay: customLimits.exportsPerDay || planLimits.exportsPerDay,
            maxKeywords: customLimits.maxKeywords || planLimits.maxKeywords,
            maxClusters: customLimits.maxClusters || planLimits.maxClusters,
            maxBriefs: customLimits.maxBriefs || planLimits.maxBriefs,
        };
    }

    async checkQuota(orgId: string, action: 'seed' | 'serp' | 'export'): Promise<boolean> {
        const [usage, limits] = await Promise.all([
            this.getUsageMetrics(orgId),
            this.getQuotaLimits(orgId),
        ]);

        switch (action) {
            case 'seed':
                return usage.seedsToday < limits.seedsPerDay;
            case 'serp':
                return usage.serpCallsToday < limits.serpCallsPerDay;
            case 'export':
                return usage.exportsToday < limits.exportsPerDay;
            default:
                return false;
        }
    }

    async incrementUsage(orgId: string, action: 'seed' | 'serp' | 'export'): Promise<void> {
        // This would typically update usage counters in a more sophisticated way
        // For now, we just log the usage
        this.logger.log(`Usage increment: ${action} for org ${orgId}`);
    }

    async getBillingPlans(): Promise<BillingPlan[]> {
        return Object.values(this.plans);
    }

    async getCurrentPlan(orgId: string): Promise<BillingPlan> {
        const org = await this.orgRepository.findOne({
            where: { id: orgId },
        });

        if (!org) {
            throw new Error('Organization not found');
        }

        const settings = org.settings || {};
        const plan = settings.plan || 'free';

        return this.plans[plan] || this.plans.free;
    }

    async upgradePlan(orgId: string, planName: string): Promise<void> {
        const org = await this.orgRepository.findOne({
            where: { id: orgId },
        });

        if (!org) {
            throw new Error('Organization not found');
        }

        if (!this.plans[planName]) {
            throw new Error('Invalid plan name');
        }

        const settings = org.settings || {};
        settings.plan = planName;
        settings.limits = this.plans[planName].limits;

        await this.orgRepository.update(orgId, { settings });
        this.logger.log(`Plan upgraded to ${planName} for org ${orgId}`);
    }

    async getUsageReport(orgId: string, startDate: Date, endDate: Date): Promise<any> {
        const [seeds, keywords, exports] = await Promise.all([
            this.seedRepository.find({
                where: {
                    project: { org: { id: orgId } },
                    createdAt: { $gte: startDate, $lte: endDate } as any,
                },
                relations: ['project'],
            }),
            this.keywordRepository
                .createQueryBuilder('keyword')
                .leftJoin('keyword.project', 'project')
                .leftJoin('project.org', 'org')
                .where('org.id = :orgId', { orgId })
                .andWhere('keyword.createdAt >= :startDate', { startDate })
                .andWhere('keyword.createdAt <= :endDate', { endDate })
                .getMany(),
            this.exportRepository.find({
                where: {
                    project: { org: { id: orgId } },
                    createdAt: { $gte: startDate, $lte: endDate } as any,
                },
                relations: ['project'],
            }),
        ]);

        return {
            period: { startDate, endDate },
            metrics: {
                totalSeeds: seeds.length,
                totalKeywords: keywords.length,
                totalExports: exports.length,
                serpCalls: keywords.filter(k => k.serpFetchedAt).length,
                clusters: keywords.filter(k => k.clusterId).length,
                briefs: keywords.filter(k => k.briefGeneratedAt).length,
            },
            breakdown: {
                byProject: this.groupByProject(seeds, keywords, exports),
                byDay: this.groupByDay(seeds, keywords, exports, startDate, endDate),
            },
        };
    }

    private groupByProject(seeds: any[], keywords: any[], exports: any[]): any {
        const projects = new Map();

        // Group seeds by project
        seeds.forEach(seed => {
            const projectId = seed.project.id;
            if (!projects.has(projectId)) {
                projects.set(projectId, {
                    projectId,
                    projectName: seed.project.name,
                    seeds: 0,
                    keywords: 0,
                    exports: 0,
                });
            }
            projects.get(projectId).seeds++;
        });

        // Group keywords by project
        keywords.forEach(keyword => {
            const projectId = keyword.project.id;
            if (!projects.has(projectId)) {
                projects.set(projectId, {
                    projectId,
                    projectName: keyword.project.name,
                    seeds: 0,
                    keywords: 0,
                    exports: 0,
                });
            }
            projects.get(projectId).keywords++;
        });

        // Group exports by project
        exports.forEach(exportItem => {
            const projectId = exportItem.project.id;
            if (!projects.has(projectId)) {
                projects.set(projectId, {
                    projectId,
                    projectName: exportItem.project.name,
                    seeds: 0,
                    keywords: 0,
                    exports: 0,
                });
            }
            projects.get(projectId).exports++;
        });

        return Array.from(projects.values());
    }

    private groupByDay(seeds: any[], keywords: any[], exports: any[], startDate: Date, endDate: Date): any[] {
        const days = new Map();
        const currentDate = new Date(startDate);

        // Initialize all days in range
        while (currentDate <= endDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            days.set(dateKey, {
                date: dateKey,
                seeds: 0,
                keywords: 0,
                exports: 0,
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Group seeds by day
        seeds.forEach(seed => {
            const dateKey = seed.createdAt.toISOString().split('T')[0];
            if (days.has(dateKey)) {
                days.get(dateKey).seeds++;
            }
        });

        // Group keywords by day
        keywords.forEach(keyword => {
            const dateKey = keyword.createdAt.toISOString().split('T')[0];
            if (days.has(dateKey)) {
                days.get(dateKey).keywords++;
            }
        });

        // Group exports by day
        exports.forEach(exportItem => {
            const dateKey = exportItem.createdAt.toISOString().split('T')[0];
            if (days.has(dateKey)) {
                days.get(dateKey).exports++;
            }
        });

        return Array.from(days.values());
    }
}
