import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { AuditModule } from '../audit/audit.module';

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
        AuditModule,
    ],
    controllers: [IntegrationsController],
    providers: [IntegrationsService],
    exports: [IntegrationsService],
})
export class IntegrationsModule { }
