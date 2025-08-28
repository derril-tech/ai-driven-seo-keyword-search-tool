import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seed } from '../entities/seed.entity';
import { CreateSeedDto, UpdateSeedDto } from './dto';

@Injectable()
export class SeedsService {
    constructor(
        @InjectRepository(Seed)
        private seedsRepository: Repository<Seed>,
    ) { }

    async create(createSeedDto: CreateSeedDto): Promise<Seed> {
        const seed = this.seedsRepository.create(createSeedDto);
        return this.seedsRepository.save(seed);
    }

    async findAll(projectId: string): Promise<Seed[]> {
        return this.seedsRepository.find({
            where: { projectId },
            relations: ['project'],
        });
    }

    async findOne(id: string): Promise<Seed> {
        const seed = await this.seedsRepository.findOne({
            where: { id },
            relations: ['project', 'keywords'],
        });

        if (!seed) {
            throw new NotFoundException(`Seed with ID ${id} not found`);
        }

        return seed;
    }

    async update(id: string, updateSeedDto: UpdateSeedDto): Promise<Seed> {
        const seed = await this.findOne(id);
        Object.assign(seed, updateSeedDto);
        return this.seedsRepository.save(seed);
    }

    async remove(id: string): Promise<void> {
        const seed = await this.findOne(id);
        await this.seedsRepository.remove(seed);
    }

    async triggerExpansion(id: string): Promise<{ message: string; jobId: string }> {
        const seed = await this.findOne(id);

        // Update seed status to processing
        seed.status = 'processing';
        await this.seedsRepository.save(seed);

        // TODO: Publish message to NATS for expansion worker
        const jobId = `expand_${seed.id}_${Date.now()}`;

        return {
            message: 'Expansion job triggered successfully',
            jobId,
        };
    }
}
