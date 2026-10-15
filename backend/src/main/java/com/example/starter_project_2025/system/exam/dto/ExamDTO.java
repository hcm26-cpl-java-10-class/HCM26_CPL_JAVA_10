package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter @Setter
public class ExamDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class)
    @Size(max = 200, groups = {OnCreate.class, OnUpdate.class})
    private String title;

    @NotNull(groups = OnCreate.class)
    @Min(value = 1, groups = {OnCreate.class, OnUpdate.class})
    private Integer durationMinutes;

    private List<Long> questionIds;

    @JsonProperty(access = READ_ONLY)
    private List<QuestionDTO> questions;

    @JsonProperty(access = READ_ONLY)
    private Integer totalPoints;
}