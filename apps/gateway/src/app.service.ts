import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getHello(): string {
        return 'AI SEO Keyword Research Tool API is running!';
    }
}
