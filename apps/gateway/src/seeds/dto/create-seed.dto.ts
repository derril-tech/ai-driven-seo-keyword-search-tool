import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSeedDto {
    @ApiProperty({ description: 'Project ID' })
    @IsUUID()
    projectId: string;

    @ApiProperty({ description: 'Seed keyword' })
    @IsString()
    keyword: string;

    @ApiProperty({ description: 'Seed URL', required: false })
    @IsOptional()
    @IsString()
    url?: string;

    @ApiProperty({ description: 'Seed domain', required: false })
    @IsOptional()
    @IsString()
    domain?: string;

    @ApiProperty({ description: 'Seed type', enum: ['keyword', 'url', 'domain'], default: 'keyword' })
    @IsOptional()
    @IsEnum(['keyword', 'url', 'domain'])
    seedType?: string;
}
