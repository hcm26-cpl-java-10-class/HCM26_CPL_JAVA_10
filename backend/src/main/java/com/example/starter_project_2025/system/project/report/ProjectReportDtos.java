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
                         String q, Integer page, Integer size, Status masterStatus) {
        public Filter normalized() {
            return new Filter(programId, cohortId, classId, mentorId, templateId, sourceVersionId, teamId,
                    projectId, status, risk == null ? Risk.ALL : risk, includeCancelled == null || includeCancelled,
                    createdFrom, createdTo, q == null ? "" : q.trim(), page == null ? 0 : page,
                    size == null ? 10 : size, masterStatus);
        }
        public static Filter empty() { return new Filter(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null); }
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
    public record Options(List<Option> programs, List<Option> cohorts, List<ClassOption> classes,
                          List<Option> mentors, List<Option> templates, List<VersionOption> versions,
                          List<TeamOption> teams, boolean canExport, String timeZone, long inactiveDays) { }
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
    public record Dashboard(Summary summary, Map<Status,Long> statuses, List<Master> content, long total,
                            int page, int size, Instant asOf, String timeZone, long inactiveDays) { }
    public record ExportRequest(Filter filters, String format) { }
    public record ExportView(UUID id, String status, String format, String fileName, Instant createdAt,
                             Instant generatedAt, Instant expiresAt, Long rowCount, String message) { }
}
