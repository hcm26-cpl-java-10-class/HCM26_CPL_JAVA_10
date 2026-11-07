package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import lombok.Builder;
import lombok.Getter;

@Getter @Builder
@ExportEntity(fileName="project-reports",sheetName="Project reports")
public class ProjectReportExportRow {
    @ExportField(name="Program") private String program;
    @ExportField(name="Cohort") private String cohort;
    @ExportField(name="Class") private String schoolClass;
    @ExportField(name="Master code") private String masterCode;
    @ExportField(name="Master project") private String master;
    @ExportField(name="Master status") private String masterStatus;
    @ExportField(name="Master template") private String template;
    @ExportField(name="Source version") private String sourceVersion;
    @ExportField(name="Level") private String level;
    @ExportField(name="Parent project ID") private String parentId;
    @ExportField(name="Project code") private String projectCode;
    @ExportField(name="Project / Sub-project") private String project;
    @ExportField(name="Team") private String team;
    @ExportField(name="Mentor") private String mentor;
    @ExportField(name="Project status") private String status;
    @ExportField(name="Backlog total") private long total;
    @ExportField(name="Backlog Todo") private long todo;
    @ExportField(name="Backlog In progress") private long inProgress;
    @ExportField(name="Backlog Review") private long review;
    @ExportField(name="Backlog Done") private long done;
    @ExportField(name="Backlog Other") private long other;
    @ExportField(name="Master backlog total in scope") private long masterTotal;
    @ExportField(name="Master backlog Todo") private long masterTodo;
    @ExportField(name="Master backlog In progress") private long masterInProgress;
    @ExportField(name="Master backlog Review") private long masterReview;
    @ExportField(name="Master backlog Done") private long masterDone;
    @ExportField(name="Accepted milestones") private int accepted;
    @ExportField(name="Milestones") private int milestones;
    @ExportField(name="Current overdue milestones") private int overdue;
    @ExportField(name="Late submission milestones") private int late;
    @ExportField(name="Inactive members") private String inactiveMembers;
    @ExportField(name="Milestone states and backlog counts") private String milestoneDetails;
    @ExportField(name="As of") private String asOf;
}
