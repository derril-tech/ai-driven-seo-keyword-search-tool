import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlingService } from './throttling.service';
import { ThrottlingGuard } from './throttling.guard';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Tenant, User]),
        RedisModule.forRoot({
            config: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD,
                db: parseInt(process.env.REDIS_DB) || 0,
            },
        }),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'your-secret-key',
            signOptions: { expiresIn: '1h' },
        }),
        AuditModule,
    ],
    providers: [ThrottlingService, ThrottlingGuard],
    exports: [ThrottlingService, ThrottlingGuard],
})
export class ThrottlingModule { }
