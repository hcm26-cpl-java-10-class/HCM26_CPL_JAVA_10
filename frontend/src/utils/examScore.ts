// NEW FILE: tiện ích điểm theo tỉ lệ. Điểm 1 câu = thang điểm * tỉ lệ câu / tổng tỉ lệ (khớp backend ExamScoring)
export const DEFAULT_MAX_SCORE = 10;

/** Hiển thị tối đa 2 số lẻ, bỏ số 0 thừa: 1 -> "1", 0.5 -> "0.5", 3.3333 -> "3.33". */
export function formatScore(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return String(Math.round(value * 100) / 100);
}

/** Điểm tối đa của một câu quy từ tỉ lệ điểm. */
export function questionScore(maxScore: number | null | undefined, weight: number, totalWeight: number): number {
    if (!totalWeight || totalWeight <= 0) return 0;
    return ((maxScore ?? DEFAULT_MAX_SCORE) * weight) / totalWeight;
}
