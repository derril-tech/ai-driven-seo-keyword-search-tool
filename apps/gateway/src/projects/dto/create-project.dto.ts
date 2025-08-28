import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
    @ApiProperty({ description: 'Organization ID' })
    @IsUUID()
    orgId: string;

    @ApiProperty({ description: 'Project name' })
    @IsString()
    name: string;

    @ApiProperty({ description: 'Project description', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ description: 'Project settings', required: false })
    @IsOptional()
    settings?: Record<string, any>;
}
