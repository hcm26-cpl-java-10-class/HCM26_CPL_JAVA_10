package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter @AllArgsConstructor
@ExportEntity(fileName="project-reports",sheetName="Project reports")
public class ProjectReportExportRow {
    @ExportField(name="Program") private String program;
    @ExportField(name="Cohort") private String cohort;
    @ExportField(name="Class") private String schoolClass;
    @ExportField(name="Master / Template") private String master;
    @ExportField(name="Source version") private String sourceVersion;
    @ExportField(name="Project code") private String projectCode;
    @ExportField(name="Sub-project") private String project;
    @ExportField(name="Team") private String team;
    @ExportField(name="Mentor") private String mentor;
    @ExportField(name="Status") private String status;
    @ExportField(name="Sub-project progress (%)") private String progress;
    @ExportField(name="Master progress in scope (%)") private String masterProgress;
    @ExportField(name="Accepted milestones") private String accepted;
    @ExportField(name="Milestones") private String milestones;
    @ExportField(name="Current overdue milestones") private String overdue;
    @ExportField(name="Late submission milestones") private String late;
    @ExportField(name="At-risk milestones") private String atRisk;
    @ExportField(name="Milestone progress") private String milestoneProgress;
    @ExportField(name="Notes") private String notes;
    @ExportField(name="As of") private String asOf;
}
