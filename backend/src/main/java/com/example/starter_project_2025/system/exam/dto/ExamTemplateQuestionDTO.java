package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class ExamTemplateQuestionDTO {
    private Long id;
    private String content;
    private QuestionType type;
    private Difficulty difficulty;
    private String topic;
    private String imageUrl;
    private int points;
    private int position;
    private List<ExamTemplateQuestionOptionDTO> options = new ArrayList<>();
}
