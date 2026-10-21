package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.system.exam.domain.ExamType;
import com.example.starter_project_2025.system.exam.domain.LatePolicy;
import com.example.starter_project_2025.system.exam.domain.ResultVisibility;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
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

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    @Min(value = 1, groups = {OnCreate.class, OnUpdate.class}, message = "maxAttempts phải >= 1")
    private Integer maxAttempts;

    private Boolean shuffleQuestions;

    private Boolean shuffleOptions;

    @Min(value = 0, groups = {OnCreate.class, OnUpdate.class}, message = "passScore phải >= 0")
    private Integer passScore;

    private LatePolicy latePolicy;

    @Min(value = 1, groups = {OnCreate.class, OnUpdate.class}, message = "latePenaltyPercent phải từ 1 đến 100")
    @Max(value = 100, groups = {OnCreate.class, OnUpdate.class}, message = "latePenaltyPercent phải từ 1 đến 100")
    private Integer latePenaltyPercent;

    @Min(value = 0, groups = {OnCreate.class, OnUpdate.class}, message = "lateGraceMinutes phải >= 0")
    private Integer lateGraceMinutes;

    private ResultVisibility resultVisibility;

    private ExamType examType;

    private List<Long> questionIds;

    @JsonProperty(access = READ_ONLY)
    private List<QuestionDTO> questions;

    @JsonProperty(access = READ_ONLY)
    private Integer totalPoints;

    @Size(max = 100, groups = {OnCreate.class, OnUpdate.class})
    private String accessCode;

    @JsonProperty(access = READ_ONLY)
    private Boolean hasPassword;
}
