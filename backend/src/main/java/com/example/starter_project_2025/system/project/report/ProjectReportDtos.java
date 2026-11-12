package com.example.starter_project_2025.system.project.report;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ProjectReportDtos {
    private ProjectReportDtos() { }
    public enum Status { DRAFT, PLANNING, ACTIVE, COMPLETED, CANCELLED }
    public enum Risk { ALL, OVERDUE, INACTIVE_MEMBERS, NEEDS_ATTENTION, LATE_SUBMISSION }
    public record Filter(Long programId, Long cohortId, Long classId, Long mentorId, Long templateId,
                         Long sourceVersionId, Long teamId, Long projectId, Status status, Risk risk,
                         Boolean includeCancelled, LocalDate createdFrom, LocalDate createdTo,
                         String q, Integer page, Integer size, Status masterStatus, Long masterId, Long workSprintId) {
        public Filter normalized() {
            return new Filter(programId, cohortId, classId, mentorId, templateId, sourceVersionId, teamId,
                    projectId, status, risk == null ? Risk.ALL : risk, includeCancelled == null || includeCancelled,
                    createdFrom, createdTo, q == null ? "" : q.trim(), page == null ? 0 : page,
                    size == null ? 10 : size, masterStatus, masterId, workSprintId);
        }
        public static Filter empty() { return new Filter(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null); }
    }
    public record BacklogCounts(long todo, long inProgress, long review, long done, long other) {
        public long total() { return todo + inProgress + review + done + other; }
        @com.fasterxml.jackson.annotation.JsonProperty("total")
        public long getTotal() { return total(); }
        public static BacklogCounts empty() { return new BacklogCounts(0,0,0,0,0); }
        public BacklogCounts plus(BacklogCounts value) {
            return new BacklogCounts(todo + value.todo, inProgress + value.inProgress, review + value.review,
                    done + value.done, other + value.other);
        }
    }
    public record Option(Long id, String name) { }
    public record ClassOption(Long id, String name, Long programId, Long cohortId) { }
    public record TeamOption(Long id, String name, Long classId) { }
    public record VersionOption(Long id, String name, Long templateId) { }
    public record ProjectOption(Long id, String name, Long masterId, Long classId, Long teamId) { }
    public record Options(List<Option> programs, List<Option> cohorts, List<ClassOption> classes,
                          List<Option> mentors, List<Option> templates, List<VersionOption> versions,
                          List<TeamOption> teams, boolean canExport, String timeZone, long inactiveDays,
                          List<ProjectOption> projects) { }
    public record InactiveMember(Long userId, String userCode, String name, Instant joinedAt,
                                 Instant lastActivityAt, Instant pendingSince) { }
    public record MilestoneRow(UUID id, String title, String status, boolean mandatory, Instant deadline,
                               BacklogCounts backlog, Instant latestSubmittedAt,
                               boolean overdue, boolean lateSubmission) { }
    /** One actual Project row. The root is represented separately from its descendant projects. */
    public record SubProject(Long id, String code, String name, Long parentProjectId, int depth,
                             Long masterId, String masterCode, String masterName, String masterKey,
                             Long classId, String className, Long cohortId, String cohortName,
                             Long programId, String programName, Long teamId, String teamName,
                             Long mentorId, String mentorName, Long templateId, String templateName,
                             Long sourceVersionId, String sourceVersion, Long workspaceId,
                             Status status, Status masterStatus, BacklogCounts backlog,
                             int acceptedMilestones, List<MilestoneRow> milestones,
                             int overdueMilestones, int lateMilestones, List<InactiveMember> inactiveMembers,
                             Instant createdAt, boolean contextOnly) { }
    public record Master(String key, Long id, String code, String name,
                         Long classId, String className, Long templateId, String templateName,
                         Long sourceVersionId, String sourceVersion, Status status, BacklogCounts backlog,
                         int scopedTeams, int matchingTeams, int subProjects, int matchingSubProjects,
                         SubProject project, List<SubProject> projects) { }
    public record Summary(long masters, long runningMasters, long classes, long cohorts, long teams,
                          long subProjects, BacklogCounts backlog, long overdueProjects,
                          long inactiveProjects, long inactiveMembers, long lateProjects) { }
    public record Overview(long activeMasters, long activeTeams, Map<String,Long> milestoneStatuses,
                           Map<String,Long> artifactStatuses, long overdueBacklogItems, long overdueSubtasks,
                           long milestoneRisks, long inactiveMembers) {
        @com.fasterxml.jackson.annotation.JsonProperty("overdueTasks")
        public long overdueTasks() { return overdueBacklogItems + overdueSubtasks; }
        @com.fasterxml.jackson.annotation.JsonProperty("riskCount")
        public long riskCount() { return overdueTasks() + milestoneRisks + inactiveMembers; }
    }
    public record SprintRow(Long id, String name, String status, Long projectId, String projectCode,
                            String projectName, Long teamId, String teamName, Instant startAt, Instant endAt,
                            BacklogCounts backlog) { }
    public record WorkReport(BacklogCounts backlog, List<SprintRow> sprints, Long selectedSprintId) { }
    public record DeliveryRow(UUID milestoneId, String title, Long projectId, String projectCode,
                              String projectName, Long masterId, String masterName, Long teamId, String teamName,
                              boolean mandatory, String milestoneStatus, String artifactStatus,
                              UUID submissionId, Integer version, Instant deadline, Instant submittedAt,
                              String reviewerName, int checklistCompleted, int checklistTotal, String attention) { }
    public record RiskRow(String key, String kind, Long projectId, String projectName, String teamName,
                          String subject, Instant deadline, String reason) { }
    public record ActivityRow(String id, Instant occurredAt, Long projectId, String projectCode,
                              String projectName, String masterName, Long teamId, String teamName,
                              String actorName, String entityType, String entityId, String subject,
                              String action, String beforeStatus, String afterStatus, String href) { }
    public record ActivityPage(List<ActivityRow> content, int offset, int limit, boolean hasMore, Instant asOf) { }
    public record ActivityHistory(List<ActivityRow> content, int page, int size, long total, Instant asOf,
                                  LocalDate activityFrom, LocalDate activityTo) { }
    public record Dashboard(Summary summary, Map<Status,Long> statuses, List<Master> content, long total,
                            int page, int size, Instant asOf, String timeZone, long inactiveDays,
                            Overview overview, WorkReport work, List<DeliveryRow> deliveries,
                            List<RiskRow> risks, ActivityPage activities) { }
    public record ExportRequest(Filter filters, String format) { }
    public record ExportView(UUID id, String status, String format, String fileName, Instant createdAt,
                             Instant generatedAt, Instant expiresAt, Long rowCount, String message) { }
}
