package com.example.starter_project_2025.system.subject;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubjectSummaryDTO {

    long totalSubjects;
    long activeSubjects;
    long inactiveSubjects;
    Map<String, Long> countByTechnicalGroup;
}
