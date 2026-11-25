package com.example.starter_project_2025.system.subject.dto;

import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubjectSyllabusDTO {

    Long subjectId;

    @Size(max = 50, message = "Pass score must not exceed 50 characters")
    String passScore;

    Map<String, Object> meta;

    List<Map<String, Object>> chapters;

    List<Map<String, Object>> assessmentScheme;
}
