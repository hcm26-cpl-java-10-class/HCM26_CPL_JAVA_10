package com.example.starter_project_2025.system.project.report;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ProjectReportDtos {
    private ProjectReportDtos() { }
    public enum Status { NOT_STARTED, IN_PROGRESS, SUBMITTED, DONE, CANCELLED }
    public enum Risk { ALL, OVERDUE, AT_RISK, NEEDS_ATTENTION, LATE_SUBMISSION }
    public record Filter(Long programId, Long cohortId, Long classId, Long mentorId, Long templateId,
                         Long sourceVersionId, Long teamId, Long projectId, Status status, Risk risk,
                         Boolean includeCancelled, LocalDate createdFrom, LocalDate createdTo,
                         String q, Integer page, Integer size) {
        public Filter normalized() {
            return new Filter(programId, cohortId, classId, mentorId, templateId, sourceVersionId, teamId,
                    projectId, status, risk == null ? Risk.ALL : risk, includeCancelled == null || includeCancelled,
                    createdFrom, createdTo, q == null ? "" : q.trim(), page == null ? 0 : page, size == null ? 10 : size);
        }
        public static Filter empty() { return new Filter(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null); }
    }
    public record Option(Long id, String name) { }
    public record ClassOption(Long id, String name, Long programId, Long cohortId) { }
    public record TeamOption(Long id, String name, Long classId) { }
    public record VersionOption(Long id, String name, Long templateId) { }
    public record Options(List<Option> programs, List<Option> cohorts, List<ClassOption> classes,
                          List<Option> mentors, List<Option> templates, List<VersionOption> versions,
                          List<TeamOption> teams, boolean canExport, String timeZone,
                          long atRiskHours, BigDecimal atRiskThreshold) { }
    public record MilestoneRow(UUID id, String title, String status, boolean mandatory, Instant deadline,
                               BigDecimal weight, BigDecimal progress, long doneTasks, long totalTasks,
                               Instant latestSubmittedAt, boolean overdue, boolean lateSubmission, boolean atRisk) { }
    public record SubProject(Long id, String code, String name, String masterKey, Long classId, String className,
                             Long cohortId, String cohortName, Long programId, String programName,
                             Long teamId, String teamName, Long mentorId, String mentorName,
                             Long templateId, String templateName, Long sourceVersionId, String sourceVersion,
                             Long workspaceId, Status status, BigDecimal progress, String weightingMode,
                             List<String> notes, int acceptedMilestones, List<MilestoneRow> milestones,
                             int overdueMilestones, int lateMilestones, int atRiskMilestones, Instant createdAt) { }
    public record Master(String key, Long classId, String className, Long templateId, String templateName,
                         Long sourceVersionId, String sourceVersion, Status status, BigDecimal progress,
                         int scopedTeams, int matchingTeams, int missingProgressTeams, List<SubProject> projects) { }
    public record Summary(long masters, long runningMasters, long classes, long cohorts, long teams,
                          long projects, BigDecimal completionRate, BigDecimal averageProgress,
                          long overdueProjects, long atRiskProjects, long lateProjects, long missingProgressProjects) { }
    public record Dashboard(Summary summary, Map<Status,Long> statuses, List<Master> content, long total,
                            int page, int size, Instant asOf, String timeZone, long atRiskHours,
                            BigDecimal atRiskThreshold) { }
    public record ExportRequest(Filter filters, String format) { }
    public record ExportView(UUID id, String status, String format, String fileName, Instant createdAt,
                             Instant generatedAt, Instant expiresAt, Long rowCount, String message) { }
}
