package com.example.starter_project_2025.system.question.dto;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter @Setter
public class QuestionDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class)
    @Size(max = 2000, groups = {OnCreate.class, OnUpdate.class})
    private String content;

    @NotNull(groups = OnCreate.class)
    private QuestionType type;

    @NotNull(groups = OnCreate.class)
    private Difficulty difficulty;

    private String topic;

    @Min(value = 1, groups = {OnCreate.class, OnUpdate.class})
    private Integer points;

    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    private Long sourceQuestionId;

    @Valid
    private List<OptionDTO> options;

    @Getter @Setter
    public static class OptionDTO {
        private Long id;

        @NotBlank(groups = {OnCreate.class, OnUpdate.class})
        @Size(max = 1000, groups = {OnCreate.class, OnUpdate.class})
        private String content;

        private boolean correct;
    }
}