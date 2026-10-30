package com.example.starter_project_2025.system.demo.enrollment;

import lombok.Data;
import java.time.LocalDate;

@Data
public class AuditLogFilterDTO {
    private String type;       // "ENROLLMENT" | "DEPARTMENT" | "ALL"
    private String search;
    private String status;
    private String source;
    private LocalDate fromDate;
    private LocalDate toDate;
}