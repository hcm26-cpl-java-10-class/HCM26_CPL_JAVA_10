package com.example.starter_project_2025.system.demo.enrollment;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogRowDTO {
    private String id;
    private String type;         // "ENROLLMENT" hoặc "DEPARTMENT"
    private String actorName;    // Người thao tác (Admin/System/Student)
    private String actorEmail;
    private String targetName;   // Tên sinh viên hoặc Tên phòng ban
    private String targetType;   // "STUDENT" hoặc "DEPARTMENT"
    private String courseName;
    private String departmentName;
    private String detail;       // Mô tả chi tiết hành động
    private String status;       // "ACTIVE", "COMPLETED", "DROPPED", etc.
    private String source;       // "SELF_ENROLLED", "MANUAL", "BATCH_IMPORT", "API"
    private LocalDateTime createdAt;
}