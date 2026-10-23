package com.example.starter_project_2025.system.project.trainingclass;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(
        name = "training_classes",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_training_class_tenant_code",
                        columnNames = {"tenant_id", "code"}
                )
        }
)
@AttributeOverride(name = "id", column = @Column(name = "class_id"))
@ImportEntity("training-class")
@ExportEntity(fileName = "training_classes", sheetName = "Classes")
@ResourcePermission("TRAINING_CLASS")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TrainingClass extends BaseEntity {

    @ImportField(name = "Class Code", required = true)
    @ExportField(name = "Class Code")
    @Column(nullable = false, length = 50)
    String code;

    @ImportField(name = "Class Name", required = true)
    @ExportField(name = "Class Name")
    @Column(nullable = false, length = 255)
    String name;

    @ImportField(name = "Tenant ID", required = true)
    @ExportField(name = "Tenant ID")
    @Column(name = "tenant_id", nullable = false)
    Long tenantId;

    @ImportField(name = "Program ID", required = true)
    @ExportField(name = "Program ID")
    @Column(name = "program_id", nullable = false)
    Long programId;

    @ImportField(name = "Program Name")
    @ExportField(name = "Program Name")
    @Column(name = "program_name", length = 255)
    String programName;

    @ImportField(name = "Cohort ID")
    @ExportField(name = "Cohort ID")
    @Column(name = "cohort_id")
    Long cohortId;

    @ImportField(name = "Cohort Name")
    @ExportField(name = "Cohort Name")
    @Column(name = "cohort_name", length = 255)
    String cohortName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_template_id")
    ProjectTemplate projectTemplate;

    @ImportField(name = "Mentor ID")
    @ExportField(name = "Mentor ID")
    @Column(name = "mentor_id")
    Long mentorId;

    @ImportField(name = "Status", required = true)
    @ExportField(name = "Status")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    TrainingClassStatus status;

    @PrePersist
    void setDefaultActiveStatus() {
        if (getIsActive() == null) {
            setIsActive(true);
        }
    }
}