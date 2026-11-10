package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

public final class AssignmentDtos {
    private AssignmentDtos() { }

    public enum Mode { SPLIT, WHOLE }

    public record ModuleTeam(@NotNull @Positive Long moduleTemplateId, @NotNull @Positive Long teamId) { }
    public record MemberRoles(@NotNull @Positive Long memberId, @NotEmpty @Size(max = 4) List<@NotBlank String> roles) { }
    public record TeamRoles(@NotNull @Positive Long teamId, @NotNull @Min(0) Long expectedVersion,
                            @NotEmpty @Size(max = 100) List<@Valid MemberRoles> members, @Positive Long leaderMemberId) { }
    public record Request(@NotNull @Positive Long masterTemplateId, @NotNull @Positive Long versionId,
                          @NotNull Mode mode, @Positive Long teamId,
                          @NotNull @Size(max = 100) List<@Valid ModuleTeam> modules,
                          @Size(max = 100) List<@Valid TeamRoles> teamRoles) {
        public Request { teamRoles = teamRoles == null ? List.of() : List.copyOf(teamRoles); }
        public Request(Long masterTemplateId, Long versionId, Mode mode, Long teamId, List<ModuleTeam> modules) {
            this(masterTemplateId, versionId, mode, teamId, modules, List.of());
        }
    }
    public record Template(Long id, Long versionId, String version, String code, String name) { }

    /** Catalogue card of a published master template; every value comes from the published snapshot. */
    public record TemplateSummary(Long id, Long versionId, String version, String code, String name, String category,
                                  String level, Integer estimatedDurationWeeks, String technologyStack,
                                  int moduleCount, int milestoneCount, int minMembers, int maxMembers,
                                  LocalDateTime publishedAt, List<String> assignedTeams) { }
    public record Catalog(List<TemplateSummary> items, long total, int page, int size, List<String> categories) { }

    public record BriefChecklistItem(String content, boolean mandatory) { }
    public record BriefRubricRating(String level, BigDecimal percentage, String description) { }
    public record BriefRubricCriterion(String code, String name, String description, BigDecimal weight,
                                       BigDecimal maxScore, List<BriefRubricRating> ratings) { }
    /** Grading rubric of a milestone; {@code legacy} marks criteria embedded in the template before rubric versions. */
    public record BriefRubric(String name, String version, String description, BigDecimal totalMaxScore,
                              boolean legacy, List<BriefRubricCriterion> criteria) { }
    public record BriefMilestone(String title, String description, Integer dueAfter, String dueUnit, BigDecimal weight,
                                 boolean mandatory, List<BriefChecklistItem> checklist, BriefRubric rubric) { }
    public record BriefBacklogItem(String title, String description, String suggestedRole) { }
    public record BriefNode(Long templateId, String code, String name, String description, String technologyStack,
                            String level, Integer estimatedDurationWeeks, int minMembers, int maxMembers,
                            com.example.starter_project_2025.system.project.ProjectTemplateConstraints.RolePolicy rolePolicy,
                            List<BriefMilestone> milestones, List<BriefBacklogItem> backlogItems, List<BriefNode> modules) { }
    /** Read-only problem statement of the published master version that would be assigned. */
    public record Brief(Long templateId, Long versionId, String version, String category, LocalDateTime publishedAt,
                        BriefNode master) { }
    public record Member(Long memberId, String name, String userCode, List<String> roles) { }
    public record Team(Long id, String name, int memberCount, String status, boolean eligible, String reason,
                       Long version, List<Member> members, Long leaderMemberId, String assignedProjectName) { }
    public record Module(Long templateId, String code, String name, int minMembers, int maxMembers,
                         int milestoneCount, List<Module> modules,
                         com.example.starter_project_2025.system.project.ProjectTemplateConstraints.RolePolicy rolePolicy) { }
    public record Owner(Long templateId, Long teamId, String teamName) { }
    public record Preview(Template master, int minMembers, int maxMembers, int masterMilestoneCount,
                          List<Module> modules, List<Team> teams,
                          com.example.starter_project_2025.system.project.ProjectTemplateConstraints.RolePolicy rolePolicy,
                          List<Owner> owners) { }
    public record Workspace(Long id, Long teamId, String teamName, Long projectId, String projectName) { }
    public record ClassMaster(Long projectId, String name, String status, Instant assignedAt) { }
    public record Result(Long assignmentId, Mode mode, Long masterProjectId, Instant assignedAt,
                         List<Workspace> workspaces) { }
}
