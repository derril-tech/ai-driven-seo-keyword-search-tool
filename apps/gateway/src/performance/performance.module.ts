import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ScheduleModule } from '@nestjs/schedule';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({
    imports: [
        RedisModule.forRoot({
            config: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD,
                db: parseInt(process.env.REDIS_DB) || 0,
            },
        }),
        ScheduleModule.forRoot(),
    ],
    controllers: [PerformanceController],
    providers: [PerformanceService],
    exports: [PerformanceService],
})
export class PerformanceModule { }
