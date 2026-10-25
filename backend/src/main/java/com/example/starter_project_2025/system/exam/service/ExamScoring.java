package com.example.starter_project_2025.system.exam.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * NEW: Quy đổi "tỉ lệ điểm" (trọng số) của từng câu hỏi ra điểm thực theo thang điểm của đề.
 *
 * Điểm của một câu = maxScore * trọngSốCâu / tổngTrọngSố. Ví dụ thang 10:
 *  - 10 câu, mỗi câu tỉ lệ 1  -> mỗi câu 1 điểm
 *  - 20 câu, mỗi câu tỉ lệ 1  -> mỗi câu 0.5 điểm
 *  - 19 câu: 18 câu tỉ lệ 1 + 1 câu tỉ lệ 2 -> 0.5 và 1 điểm
 * Điểm được lưu với 4 chữ số thập phân; giao diện hiển thị 2 chữ số.
 */
public final class ExamScoring {

    public static final BigDecimal DEFAULT_MAX_SCORE = BigDecimal.TEN;
    public static final int STORE_SCALE = 4;
    public static final int DISPLAY_SCALE = 2;

    private ExamScoring() {
    }

    /** Thang điểm của đề; bỏ trống / không hợp lệ -> 10. */
    public static BigDecimal effectiveMax(BigDecimal maxScore) {
        return maxScore == null || maxScore.signum() <= 0 ? DEFAULT_MAX_SCORE : maxScore;
    }

    /** Điểm tối đa quy ra cho tập câu có tổng trọng số {@code weight} trên {@code totalWeight}. */
    public static BigDecimal share(BigDecimal maxScore, long weight, long totalWeight) {
        if (weight <= 0 || totalWeight <= 0) {
            return BigDecimal.ZERO.setScale(STORE_SCALE);
        }
        return effectiveMax(maxScore)
                .multiply(BigDecimal.valueOf(weight))
                .divide(BigDecimal.valueOf(totalWeight), STORE_SCALE, RoundingMode.HALF_UP);
    }

    /** Điểm tối đa giáo viên được nhập cho một câu (làm tròn 2 số lẻ như giao diện hiển thị). */
    public static BigDecimal gradingCap(BigDecimal maxScore, long weight, long totalWeight) {
        return share(maxScore, weight, totalWeight).setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
    }

    /** Trừ điểm nộp muộn theo phần trăm. */
    public static BigDecimal applyPenalty(BigDecimal score, Integer penaltyPercent) {
        if (score == null) {
            return null;
        }
        if (penaltyPercent == null || penaltyPercent <= 0) {
            return score.setScale(STORE_SCALE, RoundingMode.HALF_UP);
        }
        return score.multiply(BigDecimal.valueOf(100L - penaltyPercent))
                .divide(BigDecimal.valueOf(100), STORE_SCALE, RoundingMode.HALF_UP);
    }

    /** Giữ điểm trong khoảng [0, maxScore]. */
    public static BigDecimal clamp(BigDecimal score, BigDecimal maxScore) {
        BigDecimal max = effectiveMax(maxScore);
        BigDecimal result = score.max(BigDecimal.ZERO).min(max);
        return result.setScale(STORE_SCALE, RoundingMode.HALF_UP);
    }
}
