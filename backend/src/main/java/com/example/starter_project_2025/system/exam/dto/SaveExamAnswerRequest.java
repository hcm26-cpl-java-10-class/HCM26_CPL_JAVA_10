package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class SaveExamAnswerRequest {
    @NotNull
    private Long questionId;

    private List<Long> selectedOptionIds;

    private String textAnswer;
}
