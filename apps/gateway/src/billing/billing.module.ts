import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Org } from '../entities/org.entity';
import { Project } from '../entities/project.entity';
import { Seed } from '../entities/seed.entity';
import { Keyword } from '../entities/keyword.entity';
import { Export } from '../entities/export.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Org, Project, Seed, Keyword, Export]),
    ],
    controllers: [BillingController],
    providers: [BillingService],
    exports: [BillingService],
})
export class BillingModule { }
