package com.example.starter_project_2025.system.project.aiassistant.entity;

import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_suggestions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String projectTitle;

    @Column(nullable = false, length = 5000)
    private String projectDescription;

    @Column(nullable = false, length = 100)
    private String projectType;

    @Column(columnDefinition = "TEXT")
    private String additionalRequirements;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String generatedContent;

    @Column(length = 100)
    private String aiModel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SuggestionStatus status;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();

        if (status == null) {
            status = SuggestionStatus.PENDING;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;
}