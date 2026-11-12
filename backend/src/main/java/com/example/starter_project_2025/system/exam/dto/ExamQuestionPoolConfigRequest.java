package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class ExamQuestionPoolConfigRequest {

    @NotNull
    private Boolean randomSelectionEnabled;

    private Integer randomQuestionCount;

    @NotNull
    private Boolean shuffleQuestionOrder;

    @NotEmpty
    private List<Long> questionIds;
}
