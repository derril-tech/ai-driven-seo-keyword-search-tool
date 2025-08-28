import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Health')
@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Get()
    @ApiOperation({ summary: 'Health check endpoint' })
    getHello(): string {
        return this.appService.getHello();
    }

    @Get('health')
    @ApiOperation({ summary: 'Detailed health check' })
    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: process.env.APP_VERSION || '0.1.0',
        };
    }
}
