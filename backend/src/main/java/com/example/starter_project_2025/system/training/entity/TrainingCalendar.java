package com.example.starter_project_2025.system.training.entity;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.*;

@Entity
@Table(name = "training_calendars")
@Getter @Setter @NoArgsConstructor
public class TrainingCalendar extends BaseEntity {
    @Column(nullable = false) private Long classId;
    @Column(nullable = false) private Integer revision;
    @Column(nullable = false, length = 100) private String name;
    @Column(nullable = false, length = 200) private String historyChange;
    @Column(nullable = false) private String modifiedBy;
    @Lob @Column(nullable = false, columnDefinition = "LONGTEXT") private String schedule;
    // Keep the established table contract for existing calendars and required legacy columns.
    @Column(nullable = false) private LocalDate classStartDate;
    @Column(nullable = false) private LocalDate actualLearningStartDate;
    @Column(nullable = false) private LocalDateTime lastModifiedDate;
    @Column(nullable = false) private String lastModifiedBy;
    @Lob @Column(nullable = false, columnDefinition = "LONGTEXT") private String topicsJson;

    @PrePersist @PreUpdate
    void updateLegacyAudit() {
        lastModifiedDate = LocalDateTime.now();
        lastModifiedBy = modifiedBy;
    }
}
