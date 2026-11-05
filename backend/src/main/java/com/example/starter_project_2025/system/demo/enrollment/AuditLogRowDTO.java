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
    private String targetName;   // Tên học viên (ENROLLMENT) hoặc tên department (DEPARTMENT)
    private String targetType;   // "STUDENT" hoặc "DEPARTMENT"
    private Long courseId;
    private String courseName;
    private Long departmentId;   // Chỉ có ở log DEPARTMENT
    private String departmentName;
    private Long studentCount;   // Số học viên được assign (log DEPARTMENT), 1 với log ENROLLMENT
    private String detail;       // Mô tả chi tiết hành động
    private String status;       // "ACTIVE", "DROPPED", ...
    private String source;       // "SELF_ENROLLED", "MANUAL", "DEPARTMENT", "API"
    private Integer progressPercentage;
    private String cancellationReason;
    private LocalDateTime createdAt;
}
