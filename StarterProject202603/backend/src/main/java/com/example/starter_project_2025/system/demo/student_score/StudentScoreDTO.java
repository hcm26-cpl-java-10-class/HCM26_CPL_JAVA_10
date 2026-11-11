package com.example.starter_project_2025.system.demo.student_score;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.math.BigDecimal;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class StudentScoreDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Student code is required")
    @Size(max = 30, message = "Student code must not exceed 30 characters")
    String studentCode;

    @NotBlank(groups = OnCreate.class, message = "Student name is required")
    @Size(max = 120, message = "Student name must not exceed 120 characters")
    String studentName;

    @NotBlank(groups = OnCreate.class, message = "Class name is required")
    @Size(max = 60, message = "Class name must not exceed 60 characters")
    String className;

    Map<String, BigDecimal> scores;

    @JsonProperty(access = READ_ONLY)
    BigDecimal overallScore;
}
