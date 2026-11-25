package com.example.starter_project_2025.system.learning.report;

import jakarta.persistence.*;
import java.time.*;
import static com.example.starter_project_2025.system.learning.report.ReportData.*;

@Entity
@Table(name="personal_learning_reports", uniqueConstraints=@UniqueConstraint(columnNames={"owner_id","request_key"}),
    indexes=@Index(columnList="owner_id,generated_at"))
class LearningReport {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    @Column(name="owner_id",nullable=false) Long ownerId;
    @Column(name="request_key",nullable=false,length=36) String requestKey;
    @Column(nullable=false,length=150) String title;
    @Enumerated(EnumType.STRING) @Column(nullable=false) Type type;
    @Column(nullable=false) LocalDate periodStart;
    @Column(nullable=false) LocalDate periodEnd;
    @Column(nullable=false) boolean periodToDate;
    @Column(nullable=false,length=80) String zone;
    @Enumerated(EnumType.STRING) @Column(nullable=false) Mode mode;
    @Enumerated(EnumType.STRING) @Column(nullable=false) Language language;
    @Column(nullable=false,length=150) String sections;
    @Column(name="generated_at",nullable=false) Instant generatedAt;
    @Column(nullable=false) int schemaVersion;
    @Lob @Column(nullable=false) String snapshotJson;
    @Lob String analysisJson;
    @Enumerated(EnumType.STRING) @Column(nullable=false) AnalysisStatus aiStatus;
    Instant analysisStartedAt;
    @Column(nullable=false) boolean retryable;
    @Column(nullable=false,length=64) String requestFingerprint;
    @Column(nullable=false) Instant updatedAt;
}
