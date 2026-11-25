package com.example.starter_project_2025.system.training.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "class_attendances",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_class_attendance_trainee",
                columnNames = {"class_id", "trainee_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassAttendanceEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "trainee_id", nullable = false)
    private Long traineeId;

    @Column(name = "student_id", length = 64)
    private String studentId;

    @Column(name = "full_name", length = 255)
    private String fullName;

    @Column(name = "personal_email", length = 255)
    private String personalEmail;

    @Column(name = "conducted_sessions")
    private Integer conductedSessions;

    @Column(name = "planned_sessions")
    private Integer plannedSessions;

    @Column(name = "attended_sessions")
    private Integer attendedSessions;

    @Column(name = "excused_absent")
    private Integer excusedAbsent;

    @Column(name = "unexcused_absent")
    private Integer unexcusedAbsent;

    @Column(name = "late_count")
    private Integer lateCount;

    @Column(name = "absent_rate")
    private Double absentRate;

    @Column(name = "attendance_status", length = 32)
    private String attendanceStatus;

    @Column(name = "logs_json", columnDefinition = "TEXT")
    private String logsJson;

    @Column(name = "updated_at", length = 64)
    private String updatedAt;
}
