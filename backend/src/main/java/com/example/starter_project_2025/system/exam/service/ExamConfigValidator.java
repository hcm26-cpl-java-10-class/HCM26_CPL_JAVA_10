package com.example.starter_project_2025.system.exam.service;

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
        LocalDateTime start = r.getStartTime() != null ? r.getStartTime() : (existing == null ? null : existing.getStartTime());
        LocalDateTime end = r.getEndTime() != null ? r.getEndTime() : (existing == null ? null : existing.getEndTime());
        Integer duration = r.getDurationMinutes() != null ? r.getDurationMinutes()
                : (existing == null ? null : Integer.valueOf(existing.getDurationMinutes()));
        Integer maxAttempts = r.getMaxAttempts() != null ? r.getMaxAttempts()
                : (existing == null ? Integer.valueOf(1) : existing.getMaxAttempts());
        Integer passScore = r.getPassScore() != null ? r.getPassScore() : (existing == null ? null : existing.getPassScore());
        LatePolicy latePolicy = r.getLatePolicy() != null ? r.getLatePolicy()
                : (existing == null ? LatePolicy.NOT_ALLOWED : existing.getLatePolicy());
        Integer penalty = r.getLatePenaltyPercent() != null ? r.getLatePenaltyPercent()
                : (existing == null ? null : existing.getLatePenaltyPercent());

        if (start != null && end != null) {
            if (!start.isBefore(end)) {
                ctx.add("endTime", "Thời gian đóng phải sau thời gian mở");
            } else if (duration != null && duration > Duration.between(start, end).toMinutes()) {
                ctx.add("durationMinutes", "Thời lượng làm bài không được vượt quá khoảng thời gian từ lúc mở đến lúc đóng ("
                        + Duration.between(start, end).toMinutes() + " phút)");
            }
        }

        if (maxAttempts == null || maxAttempts < 1) {
            ctx.add("maxAttempts", "Số lần làm tối đa phải >= 1");
        }

        if (passScore != null) {
            if (passScore < 0) {
                ctx.add("passScore", "Điểm đạt phải >= 0");
            } else if (totalPoints != null && totalPoints > 0 && passScore > totalPoints) {
                ctx.add("passScore", "Điểm đạt (" + passScore + ") không được lớn hơn tổng điểm của đề (" + totalPoints + ")");
            }
        }

        if (latePolicy != LatePolicy.NOT_ALLOWED && end == null) {
            ctx.add("latePolicy", "Cần đặt thời gian đóng (endTime) để áp dụng chính sách nộp muộn");
        }
        if (latePolicy == LatePolicy.ALLOWED_WITH_PENALTY && (penalty == null || penalty < 1 || penalty > 100)) {
            ctx.add("latePenaltyPercent", "Nộp muộn có trừ điểm cần phần trăm trừ từ 1 đến 100");
        }
    }
}
