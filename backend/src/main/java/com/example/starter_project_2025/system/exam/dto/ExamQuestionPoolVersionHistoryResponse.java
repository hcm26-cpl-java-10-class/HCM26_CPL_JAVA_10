package com.example.starter_project_2025.system.exam.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ExamQuestionPoolVersionHistoryResponse {

    private Long poolVersionId;

    private Integer versionNumber;

    private Boolean randomSelectionEnabled;

    private Integer randomQuestionCount;

    private Boolean shuffleQuestionOrder;

    private Integer totalQuestions;
}
