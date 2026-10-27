package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.subject.Subject;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.ColumnDefault;

import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "study_sessions")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("study_session")
@ExportEntity(fileName = "study_sessions", sheetName = "Study Sessions")
@ResourcePermission("STUDY_SESSION")
@ResourceMenu(
    title = "Study Sessions",
    group = "Academic Management",
    icon = "calendar-days",
    url = "/study-sessions",
    order = 2,
    permission = "STUDY_SESSION_READ"
)
public class StudySession extends BaseEntity {

    // Scalar references only; business relationships are not resolved in phase 3.1A.
    @Column(name = "class_id")
    Long classId;

    @Column(name = "teaching_assignment_id")
    Long teachingAssignmentId;

    @Column(name = "program_subject_id")
    Long programSubjectId;

    @Column(name = "trainer_id")
    Long trainerId;

    @Column(name = "room_id")
    Long roomId;

    @Column(name = "meeting_url", length = 2048)
    String meetingUrl;

    @Column(name = "subject_id", nullable = false)
    @ImportField(name = "Subject ID", required = true)
    @ExportField(name = "Subject ID")
    Long subjectId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", insertable = false, updatable = false, nullable = false)
    Subject subject;

    @Column(nullable = false, length = 200)
    @ImportField(name = "Title", required = true)
    @ExportField(name = "Title")
    String title;

    @Column(nullable = false)
    @ImportField(name = "Session Date", required = true)
    @ExportField(name = "Session Date")
    LocalDate sessionDate;

    @Column(nullable = false)
    @ImportField(name = "Start Time", required = true)
    @ExportField(name = "Start Time")
    LocalTime startTime;

    @Column(nullable = false)
    @ImportField(name = "End Time", required = true)
    @ExportField(name = "End Time")
    LocalTime endTime;

    @Column(length = 100)
    @ImportField(name = "Room")
    @ExportField(name = "Room")
    String room;

    @Column(length = 150)
    @ImportField(name = "Lecturer", required = true)
    @ExportField(name = "Lecturer")
    String lecturer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ImportField(name = "Type", required = true)
    @ExportField(name = "Type")
    StudySessionType type;

    @Column(length = 1000)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;

    @Column(length = 1000)
    String notes;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @ColumnDefault("'SCHEDULED'")
    @Column(nullable = false, length = 20)
    SessionStatus status = SessionStatus.SCHEDULED;

    @Column(length = 500)
    String cancelReason;
}
