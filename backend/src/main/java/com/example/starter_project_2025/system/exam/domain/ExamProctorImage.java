package com.example.starter_project_2025.system.exam.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Anh giam sat bang camera, luu trong database (data URL jpeg da thu nho).
 * eventId = null  -> anh chup luc vao thi; eventId != null -> anh bang chung cua 1 vi pham.
 */
@Entity
@Table(name = "exam_proctor_image", indexes = {
        @Index(name = "idx_proctor_attempt", columnList = "attempt_id"),
        @Index(name = "idx_proctor_exam", columnList = "exam_id"),
        @Index(name = "idx_proctor_event", columnList = "event_id")
})
@Getter @Setter @NoArgsConstructor
public class ExamProctorImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    @Column(name = "exam_id", nullable = false)
    private Long examId;

    @Column(name = "event_id")
    private Long eventId;

    @Column(nullable = false)
    private Instant capturedAt;

    @Lob
    @Column(nullable = false)
    private String imageData;
}
