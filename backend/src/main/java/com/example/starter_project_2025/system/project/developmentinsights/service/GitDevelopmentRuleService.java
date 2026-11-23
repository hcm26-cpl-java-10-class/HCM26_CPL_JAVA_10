package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRule;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitDevelopmentRuleRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceRosterService;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GitDevelopmentRuleService {
    private static final List<String> DEFAULT_COMMIT_TYPES = List.of("feat", "fix", "docs", "refactor", "test", "chore");
    private final GitActivityScopeService scopes;
    private final WorkspaceAccessService access;
    private final WorkspaceRosterService roster;
    private final GitDevelopmentRuleRepository rules;
    private final ProjectRepository projects;

    public List<RuleView> list(Long workspaceId) {
        GitActivityScope scope = scopes.require(workspaceId);
        User actor = access.requireUser(false);
        boolean canManage = canManage(actor, scope);
        var latest = rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(scope.rootProjectId()).stream()
                .collect(java.util.stream.Collectors.toMap(GitDevelopmentRule::getType, rule -> rule,
                        (left, right) -> left.getVersion() >= right.getVersion() ? left : right));
        String prefix = scope.workspace().getTaskKeyPrefix();
        return List.of(
                view(latest.get(GitDevelopmentRuleType.CONVENTIONAL_COMMIT), GitDevelopmentRuleType.CONVENTIONAL_COMMIT,
                        DEFAULT_COMMIT_TYPES, false, prefix, canManage),
                view(latest.get(GitDevelopmentRuleType.TASK_ID), GitDevelopmentRuleType.TASK_ID,
                        DEFAULT_COMMIT_TYPES, false, prefix, canManage));
    }

    @Transactional
    public RuleView save(Long workspaceId, RuleInput input) {
        GitActivityScope scope = scopes.require(workspaceId);
        User actor = access.requireUser(false);
        requireManager(actor, scope);
        if (input == null || input.type() == null) throw badRequest("A development rule type is required.");

        String pattern = input.taskKeyPattern() == null || input.taskKeyPattern().isBlank()
                ? defaultTaskPattern(scope.workspace().getTaskKeyPrefix()) : input.taskKeyPattern().trim();
        validatePattern(pattern);
        List<String> allowedTypes = normalizeTypes(input.allowedCommitTypes());
        if (input.type() == GitDevelopmentRuleType.CONVENTIONAL_COMMIT && allowedTypes.isEmpty()) {
            throw badRequest("Choose at least one supported commit type.");
        }
        Project root = projects.findForWorkspaceCreation(scope.rootProjectId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project was not found"));
        GitDevelopmentRule current = rules.findFirstByRootProject_IdAndTypeOrderByVersionDesc(
                scope.rootProjectId(), input.type()).orElse(null);
        GitDevelopmentRule saved = rules.saveAndFlush(GitDevelopmentRule.configure(root, input.type(),
                current == null ? 1 : current.getVersion() + 1, input.enabled(), String.join(",", allowedTypes),
                input.scopeRequired(), pattern, actor, Instant.now()));
        return view(saved, input.type(), allowedTypes, input.scopeRequired(),
                scope.workspace().getTaskKeyPrefix(), true);
    }

    public boolean canManage(Long workspaceId) {
        GitActivityScope scope = scopes.require(workspaceId);
        return canManage(access.requireUser(false), scope);
    }

    private boolean canManage(User actor, GitActivityScope scope) {
        if (!scope.rootScope()) return false;
        if (actor.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && ("ADMIN".equals(role.getName()) || "SUPER_ADMIN".equals(role.getName())))) return true;
        boolean mentor = scope.workspace().getTeam().getAssignedMentorId() != null
                && Objects.equals(scope.workspace().getTeam().getAssignedMentorId(), actor.getId());
        boolean memberManager = roster.current(scope.workspace().getTeam()).stream()
                .filter(member -> member.getClassMember() != null && member.getClassMember().getUser() != null
                        && Objects.equals(member.getClassMember().getUser().getId(), actor.getId()))
                .anyMatch(member -> ProjectMemberRole.hasRole(member.getRole(), "PM")
                        || access.permitted(actor, "WORKSPACE_UPDATE"));
        return mentor || memberManager;
    }

    private void requireManager(User actor, GitActivityScope scope) {
        if (!canManage(actor, scope)) throw new AccessDeniedException("Project development rules can only be changed by an authorized root Project Manager");
    }

    private RuleView view(GitDevelopmentRule rule, GitDevelopmentRuleType type, List<String> defaults,
                          boolean scopeRequired, String rawPrefix, boolean canManage) {
        String prefix = rawPrefix == null || rawPrefix.isBlank() ? "FA" : rawPrefix.trim();
        String pattern = defaultTaskPattern(prefix);
        List<String> types = rule == null ? defaults : parseTypes(rule.getAllowedCommitTypes());
        return new RuleView(type, rule != null && rule.isEnabled(), rule == null ? 0 : rule.getVersion(),
                types, rule == null ? scopeRequired : rule.isScopeRequired(),
                rule == null ? pattern : rule.getTaskKeyPattern(), canManage,
                rule == null ? null : rule.getCreatedAt(), pattern, prefix + "-123");
    }

    private List<String> normalizeTypes(List<String> values) {
        if (values == null) return DEFAULT_COMMIT_TYPES;
        List<String> allowed = values.stream().filter(Objects::nonNull)
                .map(value -> value.trim().toLowerCase(Locale.ROOT)).filter(value -> !value.isBlank()).distinct().toList();
        if (allowed.stream().anyMatch(value -> !DEFAULT_COMMIT_TYPES.contains(value))) {
            throw badRequest("Supported Conventional Commit types are feat, fix, docs, refactor, test and chore.");
        }
        return allowed;
    }

    private List<String> parseTypes(String value) {
        return value == null || value.isBlank() ? DEFAULT_COMMIT_TYPES : List.of(value.split(","));
    }

    private String defaultTaskPattern(String rawPrefix) {
        String prefix = rawPrefix == null || rawPrefix.isBlank() ? "FA" : rawPrefix.trim();
        return "(?i)\\b" + Pattern.quote(prefix) + "-\\d+\\b";
    }

    private void validatePattern(String value) {
        if (value == null || value.isBlank() || value.length() > 160) throw badRequest("Task ID pattern is required and must be 160 characters or fewer.");
        try {
            Pattern.compile(value);
        } catch (PatternSyntaxException ex) {
            throw badRequest("Task ID pattern is not a valid regular expression.");
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    public record RuleInput(@NotNull GitDevelopmentRuleType type, boolean enabled, List<String> allowedCommitTypes,
                            boolean scopeRequired, String taskKeyPattern) { }

    public record RuleView(GitDevelopmentRuleType type, boolean enabled, int version, List<String> allowedCommitTypes,
                           boolean scopeRequired, String taskKeyPattern, boolean canManage, Instant updatedAt,
                           String defaultTaskKeyPattern, String taskKeyExample) { }
}
