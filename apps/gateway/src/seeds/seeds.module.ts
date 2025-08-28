import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedsController } from './seeds.controller';
import { SeedsService } from './seeds.service';
import { Seed } from '../entities/seed.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Seed])],
    controllers: [SeedsController],
    providers: [SeedsService],
    exports: [SeedsService],
})
export class SeedsModule { }
