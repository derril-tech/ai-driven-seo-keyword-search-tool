import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login')
    @ApiOperation({ summary: 'User login' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    async login(@Body() loginDto: { email: string; password: string }) {
        // TODO: Implement proper authentication
        const token = await this.authService.generateToken({
            sub: 'demo-user-id',
            email: loginDto.email,
        });

        return {
            access_token: token,
            token_type: 'Bearer',
        };
    }
}
