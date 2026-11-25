package com.example.starter_project_2025.system.question.version;

import java.util.List;

/** Serializable copy of the editable parts of a question. */
public record QuestionSnapshot(String content, String type, String difficulty, String topic, String imageUrl,
                               int points, String codeSpec, List<Option> options, List<Criterion> gradingCriteria) {

    public record Option(Long id, String content, boolean correct, String imageUrl) {
    }

    public record Criterion(String name, String description, Integer weightPercentage) {
    }
}
