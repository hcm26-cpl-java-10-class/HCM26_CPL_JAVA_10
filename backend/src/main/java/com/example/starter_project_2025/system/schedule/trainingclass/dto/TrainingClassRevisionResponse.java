package com.example.starter_project_2025.system.schedule.trainingclass.dto;

import com.example.starter_project_2025.system.schedule.trainingclass.ClassRevisionStatus;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
public class TrainingClassRevisionResponse {
    private Long id;
    private Long classId;
    private Long version;
    private Integer revisionNo;
    private Long baseRevisionId;
    private ClassRevisionStatus status;
    private String name;
    private String description;
    private String traineeType;
    private String deliveryFormat;
    private String site;
    private String location;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer capacity;
    private Long createdBy;
    private LocalDateTime createdAt;
    private Long updatedBy;
    private LocalDateTime updatedAt;
    private Long submittedBy;
    private LocalDateTime submittedAt;
    private Long reviewedBy;
    private LocalDateTime reviewedAt;
    private String rejectionReason;
    private boolean dependencyValidationRequired;
}
