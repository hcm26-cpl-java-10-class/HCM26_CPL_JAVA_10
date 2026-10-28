package com.example.starter_project_2025.system.exam.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExamTemplateQuestionOptionDTO {
    private Long id;
    private String content;
    private boolean isCorrect;
    private String imageUrl;
    private int position;
}
