package com.example.starter_project_2025.system.schedule.trainingclass.dto;

import com.example.starter_project_2025.system.schedule.trainingclass.ClassStatus;
import com.example.starter_project_2025.system.schedule.trainingclass.ClassRevisionStatus;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrainingClassResponse {

    private Long id;
    private Long version;
    private Long currentRevisionId;
    private Integer currentRevisionNo;
    private Long pendingRevisionId;
    private Integer pendingRevisionNo;
    private ClassRevisionStatus pendingRevisionStatus;
    private Integer lastIssuedRevisionNo;
    private String code;
    private String name;
    private String description;

    private String traineeType;
    private String deliveryFormat;
    private String site;
    private String location;

    private Long programVersionId;

    private LocalDate startDate;
    private LocalDate endDate;
    private Integer capacity;

    private ClassStatus status;

    private Boolean isActive;

    private LocalDateTime createdAt;
    private Long createdBy;

    private LocalDateTime updatedAt;
    private Long updatedBy;

    private Long openClassRequestId;
}
