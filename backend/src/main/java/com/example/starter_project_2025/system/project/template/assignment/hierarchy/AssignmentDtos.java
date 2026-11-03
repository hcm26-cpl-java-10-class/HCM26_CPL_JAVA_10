package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

public final class AssignmentDtos {
    private AssignmentDtos() { }

    public enum Mode { SPLIT, WHOLE }

    public record ModuleTeam(@NotNull @Positive Long moduleTemplateId, @NotNull @Positive Long teamId) { }
    public record MemberRoles(@NotNull @Positive Long memberId, @NotEmpty @Size(max = 4) List<@NotBlank String> roles) { }
    public record TeamRoles(@NotNull @Positive Long teamId, @NotNull @Min(0) Long expectedVersion,
                            @NotEmpty @Size(max = 100) List<@Valid MemberRoles> members) { }
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
    public record Member(Long memberId, String name, String userCode, List<String> roles) { }
    public record Team(Long id, String name, int memberCount, String status, boolean eligible, String reason,
                       Long version, List<Member> members) { }
    public record Module(Long templateId, String code, String name, int minMembers, int maxMembers,
                         int milestoneCount, List<Module> modules,
                         com.example.starter_project_2025.system.project.ProjectTemplateConstraints.RolePolicy rolePolicy) { }
    public record Preview(Template master, int minMembers, int maxMembers, int masterMilestoneCount,
                          List<Module> modules, List<Team> teams,
                          com.example.starter_project_2025.system.project.ProjectTemplateConstraints.RolePolicy rolePolicy) { }
    public record Workspace(Long id, Long teamId, String teamName, Long projectId, String projectName) { }
    public record ClassMaster(Long projectId, String name, String status, Instant assignedAt) { }
    public record Result(Long assignmentId, Mode mode, Long masterProjectId, Instant assignedAt,
                         List<Workspace> workspaces) { }
}
