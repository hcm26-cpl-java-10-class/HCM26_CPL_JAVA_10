package com.example.starter_project_2025.system.exam.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** NEW (anti-cheat): 1 dong = 1 lan vi pham cua 1 luot lam bai. */
@Entity
@Table(name = "exam_integrity_event", indexes = {
        @Index(name = "idx_integrity_attempt", columnList = "attempt_id"),
        @Index(name = "idx_integrity_exam", columnList = "exam_id")
})
@Getter @Setter @NoArgsConstructor
public class ExamIntegrityEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    @Column(name = "exam_id", nullable = false)
    private Long examId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private IntegrityEventType type;

    /** Thoi diem xay ra (server nhan). */
    @Column(nullable = false)
    private Instant occurredAt;

    /** Thoi gian roi khoi bai thi (giay) - chi co voi TAB_HIDDEN / WINDOW_BLUR / FULLSCREEN_EXIT. */
    private Integer durationSeconds;

    @Column(length = 300)
    private String detail;

    @Column(length = 300)
    private String userAgent;

    @Column(length = 64)
    private String ipAddress;
}
