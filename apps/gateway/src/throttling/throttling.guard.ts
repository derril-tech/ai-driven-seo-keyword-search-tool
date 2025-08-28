import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlingService } from './throttling.service';
import { JwtService } from '@nestjs/jwt';

export interface ThrottleOptions {
    quotaType?: string;
    amount?: number;
    endpoint?: string;
}

export const THROTTLE_KEY = 'throttle';

export const Throttle = (options: ThrottleOptions = {}) => {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        Reflect.defineMetadata(THROTTLE_KEY, options, descriptor.value);
        return descriptor;
    };
};

@Injectable()
export class ThrottlingGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly throttlingService: ThrottlingService,
        private readonly jwtService: JwtService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const handler = context.getHandler();

        const throttleOptions = this.reflector.get<ThrottleOptions>(
            THROTTLE_KEY,
            handler,
        );

        if (!throttleOptions) {
            return true; // No throttling required
        }

        try {
            // Extract user and tenant information
            const { userId, tenantId } = await this.extractUserInfo(request);

            if (!userId || !tenantId) {
                throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED);
            }

            const endpoint = throttleOptions.endpoint || request.route?.path || request.url;

            // Check rate limit
            const rateLimitConfig = this.throttlingService.getRateLimitConfig(endpoint);
            const rateLimitResult = await this.throttlingService.checkRateLimit(
                userId,
                tenantId,
                endpoint,
                rateLimitConfig,
            );

            if (!rateLimitResult.allowed) {
                throw new HttpException(
                    {
                        message: 'Rate limit exceeded',
                        remaining: rateLimitResult.remaining,
                        resetTime: rateLimitResult.resetTime,
                    },
                    HttpStatus.TOO_MANY_REQUESTS,
                );
            }

            // Check quota if specified
            if (throttleOptions.quotaType) {
                const quotaResult = await this.throttlingService.checkQuota(
                    tenantId,
                    throttleOptions.quotaType as any,
                    throttleOptions.amount || 1,
                );

                if (!quotaResult.allowed) {
                    throw new HttpException(
                        {
                            message: 'Quota exceeded',
                            quotaType: throttleOptions.quotaType,
                            remaining: quotaResult.remaining,
                            quota: quotaResult.quota,
                        },
                        HttpStatus.TOO_MANY_REQUESTS,
                    );
                }
            }

            // Add rate limit headers to response
            const response = context.switchToHttp().getResponse();
            response.header('X-RateLimit-Limit', rateLimitConfig.maxRequests);
            response.header('X-RateLimit-Remaining', rateLimitResult.remaining);
            response.header('X-RateLimit-Reset', rateLimitResult.resetTime);

            return true;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            // Log the error but don't block the request
            console.error('Throttling guard error:', error);
            return true;
        }
    }

    private async extractUserInfo(request: any): Promise<{ userId: string; tenantId: string }> {
        // Try to get from JWT token first
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const payload = this.jwtService.verify(token);
                return {
                    userId: payload.sub,
                    tenantId: payload.tenantId || payload.tenant_id,
                };
            } catch (error) {
                // Token verification failed, continue to other methods
            }
        }

        // Try to get from request body or query params
        const userId = request.body?.userId || request.query?.userId || request.user?.id;
        const tenantId = request.body?.tenantId || request.query?.tenantId || request.user?.tenantId;

        return { userId, tenantId };
    }
}
