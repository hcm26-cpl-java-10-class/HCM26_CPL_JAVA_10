package com.example.starter_project_2025.system.exam.service;

import java.math.BigDecimal;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.LatePolicy;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;

@Component
public class ExamConfigValidator {

    public void validate(Exam existing, ExamDTO r, Integer totalPoints, ValidationContext ctx) {
        Integer duration = r.getDurationMinutes() != null ? r.getDurationMinutes()
                : (existing == null ? null : Integer.valueOf(existing.getDurationMinutes()));
        Integer maxAttempts = r.getMaxAttempts() != null ? r.getMaxAttempts()
                : (existing == null ? Integer.valueOf(1) : existing.getMaxAttempts());
        BigDecimal passScore = r.getPassScore() != null ? r.getPassScore() : (existing == null ? null : existing.getPassScore());
        BigDecimal maxScore = ExamScoring.effectiveMax(r.getMaxScore() != null ? r.getMaxScore()
                : (existing == null ? null : existing.getMaxScore()));
        if (r.getMaxScore() != null && (r.getMaxScore().signum() <= 0 || r.getMaxScore().compareTo(BigDecimal.valueOf(1000)) > 0)) {
            ctx.add("maxScore", "Thang điểm phải lớn hơn 0 và không quá 1000");
        }
        {
            if (r.getHeadTurnAngleDeg() != null && (r.getHeadTurnAngleDeg() < 10 || r.getHeadTurnAngleDeg() > 80)) {
                ctx.add("headTurnAngleDeg", "Head-turn angle must be between 10 and 80 degrees");
            }
            if (r.getHeadTurnSeconds() != null && (r.getHeadTurnSeconds() < 1 || r.getHeadTurnSeconds() > 30)) {
                ctx.add("headTurnSeconds", "Head-turn time must be between 1 and 30 seconds");
            }
            if (r.getFastSubmitPercent() != null && (r.getFastSubmitPercent() < 1 || r.getFastSubmitPercent() > 50)) {
                ctx.add("fastSubmitPercent", "Fast-submission threshold must be between 1% and 50% of the exam time");
            }
        }
        LatePolicy latePolicy = r.getLatePolicy() != null ? r.getLatePolicy()
                : (existing == null ? LatePolicy.NOT_ALLOWED : existing.getLatePolicy());
        Integer penalty = r.getLatePenaltyPercent() != null ? r.getLatePenaltyPercent()
                : (existing == null ? null : existing.getLatePenaltyPercent());
        Integer lateGraceMinutes = r.getLateGraceMinutes() != null ? r.getLateGraceMinutes()
                : (existing == null ? 0 : existing.getLateGraceMinutes());

        if (maxAttempts == null || maxAttempts < 1) {
            ctx.add("maxAttempts", "Số lần làm tối đa phải >= 1");
        }

        if (passScore != null) {
            if (passScore.signum() < 0) {
                ctx.add("passScore", "Điểm đạt phải >= 0");
            } else if (passScore.compareTo(maxScore) > 0) {
                ctx.add("passScore", "Điểm đạt (" + passScore.stripTrailingZeros().toPlainString()
                        + ") không được lớn hơn thang điểm của đề (" + maxScore.stripTrailingZeros().toPlainString() + ")");
            }
        }

        if (latePolicy == LatePolicy.ALLOWED_WITH_PENALTY && (penalty == null || penalty < 1 || penalty > 100)) {
            ctx.add("latePenaltyPercent", "Nộp muộn có trừ điểm cần phần trăm trừ từ 1 đến 100");
        }
        if (lateGraceMinutes == null || lateGraceMinutes < 0) {
            ctx.add("lateGraceMinutes", "Thời gian gia hạn phải >= 0 phút");
        }
        if (latePolicy == LatePolicy.NOT_ALLOWED && lateGraceMinutes != null && lateGraceMinutes > 0) {
            ctx.add("lateGraceMinutes", "Chỉ cấu hình thời gian gia hạn khi cho phép nộp muộn");
        }
    }
}
