package com.example.starter_project_2025.system.question.dto;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class QuestionFilter extends BaseFilter {

    @FilterField(entityField = "type")
    private QuestionType type;

    @FilterField(entityField = "difficulty")
    private Difficulty difficulty;

    @FilterField(entityField = "topic")
    private String topic;

    public void setTopic(String topic) {
        this.topic = (topic == null || topic.isBlank()) ? null : topic.trim().toLowerCase();
    }
}