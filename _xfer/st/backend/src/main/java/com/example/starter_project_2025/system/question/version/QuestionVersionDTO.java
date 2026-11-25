package com.example.starter_project_2025.system.question.version;

import java.time.Instant;

public record QuestionVersionDTO(Long id, int versionNumber, String note, Long createdBy, String createdByName,
                                 Instant createdAt, QuestionSnapshot snapshot) {
}
