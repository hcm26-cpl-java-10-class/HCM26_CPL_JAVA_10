package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.ExamAttempt;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class ExamScoring {

    public static final BigDecimal DEFAULT_MAX_SCORE = BigDecimal.TEN;
    public static final int STORE_SCALE = 4;
    public static final int DISPLAY_SCALE = 2;

    private ExamScoring() {
    }

    /** Diem dat cua luot lam: ban da dong bang luc bat dau, luot cu chua co thi lay cau hinh hien tai cua de. */
    public static BigDecimal effectivePassScore(ExamAttempt attempt) {
        if (attempt.getPassScore() != null) {
            return attempt.getPassScore();
        }
        return attempt.getExam() == null ? null : attempt.getExam().getPassScore();
    }

    /** Dat khi diem cuoi >= diem dat; null khi de khong dat diem dat hoac chua co diem cuoi. */
    public static Boolean passed(BigDecimal finalScore, BigDecimal passScore) {
        if (finalScore == null || passScore == null) {
            return null;
        }
        return finalScore.compareTo(passScore) >= 0;
    }

    public static Boolean passed(ExamAttempt attempt) {
        return passed(attempt.getFinalScore(), effectivePassScore(attempt));
    }

    public static BigDecimal effectiveMax(BigDecimal maxScore) {
        return maxScore == null || maxScore.signum() <= 0 ? DEFAULT_MAX_SCORE : maxScore;
    }

    public static BigDecimal share(BigDecimal maxScore, long weight, long totalWeight) {
        if (weight <= 0 || totalWeight <= 0) {
            return BigDecimal.ZERO.setScale(STORE_SCALE);
        }
        return effectiveMax(maxScore)
                .multiply(BigDecimal.valueOf(weight))
                .divide(BigDecimal.valueOf(totalWeight), STORE_SCALE, RoundingMode.HALF_UP);
    }

    /** Nhu share(...) nhung trong so co the le (vd. cau lap trinh dat 8/10 test). */
    public static BigDecimal share(BigDecimal maxScore, BigDecimal weight, long totalWeight) {
        if (weight == null || weight.signum() <= 0 || totalWeight <= 0) {
            return BigDecimal.ZERO.setScale(STORE_SCALE);
        }
        return effectiveMax(maxScore)
                .multiply(weight)
                .divide(BigDecimal.valueOf(totalWeight), STORE_SCALE, RoundingMode.HALF_UP);
    }

    public static BigDecimal gradingCap(BigDecimal maxScore, long weight, long totalWeight) {
        return share(maxScore, weight, totalWeight).setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
    }

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

    public static BigDecimal clamp(BigDecimal score, BigDecimal maxScore) {
        BigDecimal max = effectiveMax(maxScore);
        BigDecimal result = score.max(BigDecimal.ZERO).min(max);
        return result.setScale(STORE_SCALE, RoundingMode.HALF_UP);
    }
}
