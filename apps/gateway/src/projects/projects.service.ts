import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { CreateProjectDto, UpdateProjectDto } from './dto';

@Injectable()
export class ProjectsService {
    constructor(
        @InjectRepository(Project)
        private projectsRepository: Repository<Project>,
    ) { }

    async create(createProjectDto: CreateProjectDto): Promise<Project> {
        const project = this.projectsRepository.create(createProjectDto);
        return this.projectsRepository.save(project);
    }

    async findAll(orgId: string): Promise<Project[]> {
        return this.projectsRepository.find({
            where: { orgId },
            relations: ['organization'],
        });
    }

    async findOne(id: string): Promise<Project> {
        const project = await this.projectsRepository.findOne({
            where: { id },
            relations: ['organization', 'seeds', 'keywords', 'clusters'],
        });

        if (!project) {
            throw new NotFoundException(`Project with ID ${id} not found`);
        }

        return project;
    }

    async update(id: string, updateProjectDto: UpdateProjectDto): Promise<Project> {
        const project = await this.findOne(id);
        Object.assign(project, updateProjectDto);
        return this.projectsRepository.save(project);
    }

    async remove(id: string): Promise<void> {
        const project = await this.findOne(id);
        await this.projectsRepository.remove(project);
    }
}
