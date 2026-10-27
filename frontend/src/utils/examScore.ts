export const DEFAULT_MAX_SCORE = 10;

export function formatScore(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return String(Math.round(value * 100) / 100);
}

export function questionScore(maxScore: number | null | undefined, weight: number, totalWeight: number): number {
    if (!totalWeight || totalWeight <= 0) return 0;
    return ((maxScore ?? DEFAULT_MAX_SCORE) * weight) / totalWeight;
}
