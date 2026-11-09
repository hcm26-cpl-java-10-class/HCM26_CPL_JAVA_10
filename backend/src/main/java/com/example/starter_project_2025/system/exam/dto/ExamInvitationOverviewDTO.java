package com.example.starter_project_2025.system.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Tổng quan lời mời theo từng đề thi (dùng cho trang danh sách của giáo viên).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamInvitationOverviewDTO {

    private Long examId;
    private String examTitle;

    private Integer total;
    private Integer pending;
    private Integer sent;
    private Integer accepted;
    private Integer rejected;
    private Integer expired;
    private Integer revoked;
    private Integer completed;
    private Integer anonymous;
}
