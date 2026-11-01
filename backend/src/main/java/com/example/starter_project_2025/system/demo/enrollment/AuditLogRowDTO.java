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
    private String type;         // "ENROLLMENT" hoáº·c "DEPARTMENT"
    private String actorName;    // NgÆ°á»i thao tÃ¡c (Admin/System/Student)
    private String actorEmail;
    private String targetName;   // TÃªn sinh viÃªn hoáº·c TÃªn phÃ²ng ban
    private String targetType;   // "STUDENT" hoáº·c "DEPARTMENT"
    private String courseName;
    private String departmentName;
    private String detail;       // MÃ´ táº£ chi tiáº¿t hÃ nh Ä‘á»™ng
    private String status;       // "ACTIVE", "COMPLETED", "DROPPED", etc.
    private String source;       // "SELF_ENROLLED", "MANUAL", "BATCH_IMPORT", "API"
    private Integer progressPercentage;
    private String cancellationReason;
    private LocalDateTime createdAt;
}
