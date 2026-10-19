package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.question.dto.QuestionTakerDTO;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter @Setter
public class ExamTakerDTO {
    private Long id;
    private String title;
    private int durationMinutes;
    private int totalPoints;
    private List<QuestionTakerDTO> questions;
}