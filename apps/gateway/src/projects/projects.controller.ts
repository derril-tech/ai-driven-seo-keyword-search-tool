import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new project' })
    @ApiResponse({ status: 201, description: 'Project created successfully' })
    async create(@Body() createProjectDto: CreateProjectDto) {
        return this.projectsService.create(createProjectDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all projects for the current user' })
    @ApiResponse({ status: 200, description: 'Projects retrieved successfully' })
    async findAll(@Query('orgId') orgId: string) {
        return this.projectsService.findAll(orgId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a project by ID' })
    @ApiResponse({ status: 200, description: 'Project retrieved successfully' })
    async findOne(@Param('id') id: string) {
        return this.projectsService.findOne(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a project' })
    @ApiResponse({ status: 200, description: 'Project updated successfully' })
    async update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
        return this.projectsService.update(id, updateProjectDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a project' })
    @ApiResponse({ status: 200, description: 'Project deleted successfully' })
    async remove(@Param('id') id: string) {
        return this.projectsService.remove(id);
    }
}
