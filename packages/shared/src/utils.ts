import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
    return uuidv4();
}

export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString();
}

export function isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

export function sanitizeKeyword(keyword: string): string {
    return keyword.trim().toLowerCase();
}

export function calculateSimilarity(score: number): string {
    if (score >= 0.9) return 'very_high';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
}

export function getIntentColor(intent: string): string {
    const colors = {
        informational: '#3b82f6',
        commercial: '#10b981',
        transactional: '#f59e0b',
        navigational: '#8b5cf6',
        local: '#ef4444',
    };
    return colors[intent as keyof typeof colors] || '#6b7280';
}

export function formatNumber(num: number): string {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}
