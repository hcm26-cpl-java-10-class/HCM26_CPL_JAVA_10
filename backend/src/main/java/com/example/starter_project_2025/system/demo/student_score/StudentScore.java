package com.example.starter_project_2025.system.demo.student_score;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "student_scores")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("student-score")
@ExportEntity(fileName = "student_scores", sheetName = "Student Scores")
@ResourcePermission("STUDENT_SCORE")
@ResourceMenu(
        title = "Student Scores",
        group = "Score Management",
        icon = "bar-chart",
        url = "/student-scores",
        order = 1,
        permission = "STUDENT_SCORE_READ"
)
public class StudentScore extends BaseEntity {

    @Column(unique = true, nullable = false, length = 30)
    @ImportField(name = "Student Code", required = true)
    @ExportField(name = "Student Code")
    String studentCode;

    @Column(nullable = false, length = 120)
    @ImportField(name = "Student Name", required = true)
    @ExportField(name = "Student Name")
    String studentName;

    @Column(nullable = false, length = 60)
    @ImportField(name = "Class Name", required = true)
    @ExportField(name = "Class Name")
    String className;

    @Builder.Default
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "student_score_columns", joinColumns = @JoinColumn(name = "student_score_id"))
    @MapKeyColumn(name = "score_key", length = 80)
    @Column(name = "score_value", precision = 8, scale = 2)
    @ExportField(name = "Scores")
    Map<String, BigDecimal> scores = new LinkedHashMap<>();

    @Column(precision = 8, scale = 2)
    @ExportField(name = "Overall Score")
    BigDecimal overallScore;

    public enum Status { DRAFT, REVIEWED, RELEASED, ADJUSTED }

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    Status status = Status.DRAFT;

    LocalDateTime releasedAt;

    @Column(length = 120)
    String approvedBy;

    @Column(length = 120)
    String studentEmail;

    @Column(length = 10000)
    String adjustmentLog;

    public boolean isPublished() {
        return status == Status.RELEASED || status == Status.ADJUSTED;
    }
}
