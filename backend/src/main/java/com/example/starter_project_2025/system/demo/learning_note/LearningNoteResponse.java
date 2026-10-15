
package com.example.starter_project_2025.system.demo.learning_note;

import java.time.LocalDateTime;

public record LearningNoteResponse(
        Long id,
        Long courseId,
        String content,
        LocalDateTime createdAt
) {
}
