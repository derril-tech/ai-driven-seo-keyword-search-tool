import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProjectsModule } from './projects/projects.module';
import { SeedsModule } from './seeds/seeds.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { Org } from './entities/org.entity';
import { User } from './entities/user.entity';
import { Project } from './entities/project.entity';
import { Seed } from './entities/seed.entity';
import { Keyword } from './entities/keyword.entity';
import { Cluster } from './entities/cluster.entity';
import { SerpResult } from './entities/serp-result.entity';
import { Brief } from './entities/brief.entity';
import { Export } from './entities/export.entity';
import { AuditLog } from './entities/audit-log.entity';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 5432,
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'ai_seo_tool',
            entities: [Org, User, Project, Seed, Keyword, Cluster, SerpResult, Brief, Export, AuditLog],
            synchronize: process.env.NODE_ENV !== 'production',
            logging: process.env.NODE_ENV === 'development',
        }),
        ProjectsModule,
        SeedsModule,
        AuthModule,
        BillingModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
