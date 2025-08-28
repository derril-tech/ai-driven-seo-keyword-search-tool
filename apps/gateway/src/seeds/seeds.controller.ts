import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SeedsService } from './seeds.service';
import { CreateSeedDto, UpdateSeedDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Seeds')
@Controller('seeds')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SeedsController {
    constructor(private readonly seedsService: SeedsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new seed' })
    @ApiResponse({ status: 201, description: 'Seed created successfully' })
    async create(@Body() createSeedDto: CreateSeedDto) {
        return this.seedsService.create(createSeedDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all seeds for a project' })
    @ApiResponse({ status: 200, description: 'Seeds retrieved successfully' })
    async findAll(@Query('projectId') projectId: string) {
        return this.seedsService.findAll(projectId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a seed by ID' })
    @ApiResponse({ status: 200, description: 'Seed retrieved successfully' })
    async findOne(@Param('id') id: string) {
        return this.seedsService.findOne(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a seed' })
    @ApiResponse({ status: 200, description: 'Seed updated successfully' })
    async update(@Param('id') id: string, @Body() updateSeedDto: UpdateSeedDto) {
        return this.seedsService.update(id, updateSeedDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a seed' })
    @ApiResponse({ status: 200, description: 'Seed deleted successfully' })
    async remove(@Param('id') id: string) {
        return this.seedsService.remove(id);
    }

    @Post(':id/expand')
    @ApiOperation({ summary: 'Trigger keyword expansion for a seed' })
    @ApiResponse({ status: 200, description: 'Expansion triggered successfully' })
    async expand(@Param('id') id: string) {
        return this.seedsService.triggerExpansion(id);
    }
}
