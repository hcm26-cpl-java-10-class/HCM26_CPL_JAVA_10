package com.example.starter_project_2025.system.demo.report;

import java.util.List;

public record LearningHoursReportDTO(
        List<LearningHoursRowDTO> rows,
        LearningHoursTotalsDTO totals,
        List<LearningHoursGroupDTO> departments,
        List<LearningHoursGroupDTO> courses,
        List<LearningHoursGroupDTO> students
) {
}
