import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Project } from '../entities/project.entity';
import { Keyword } from '../entities/keyword.entity';
import { Cluster } from '../entities/cluster.entity';
import { Export } from '../entities/export.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Project, Keyword, Cluster, Export, AuditLog]),
        RedisModule.forRoot({
            config: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD,
                db: parseInt(process.env.REDIS_DB) || 0,
            },
        }),
    ],
    controllers: [AnalyticsController],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule { }
