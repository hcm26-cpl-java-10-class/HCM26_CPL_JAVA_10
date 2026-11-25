package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.dto.GitRepositoryItem;
import com.example.starter_project_2025.system.git_integration.dto.GitRepositoryPage;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * US-GI-03: browse the repositories an installation can access, with
 * server-side search, filtering and paging on the cached GitHub list.
 * Read-only: nothing is written to {@code git_repositories} here (AC04).
 */
@Slf4j
@Service
public class GitRepositoryBrowseService {

    public static final int DEFAULT_SIZE = 20;
    public static final int MAX_SIZE = 50;
    public static final int MAX_QUERY_LENGTH = 100;

    static final String LINKED_TO_OTHER_PROJECT = "LINKED_TO_OTHER_PROJECT";
    static final String LINKED_TO_THIS_PROJECT = "LINKED_TO_THIS_PROJECT";
    static final String ARCHIVED = "ARCHIVED";
    static final String DISABLED = "DISABLED";

    private final GitIntegrationAccessService access;
    private final GitInstallationRepository installations;
    private final GitRepositoryRepository repositoryConnections;
    private final ProjectRepository projects;
    private final InstallationRepositoryCache cache;
    private final GitHubFailures failures;
    private final Clock clock;

    public GitRepositoryBrowseService(GitIntegrationAccessService access, GitInstallationRepository installations,
                                      GitRepositoryRepository repositoryConnections, ProjectRepository projects,
                                      InstallationRepositoryCache cache, GitHubFailures failures,
                                      @Qualifier("gitIntegrationClock") Clock clock) {
        this.access = access;
        this.installations = installations;
        this.repositoryConnections = repositoryConnections;
        this.projects = projects;
        this.cache = cache;
        this.failures = failures;
        this.clock = clock;
    }

    public enum Filter { ALL, AVAILABLE, LINKED }

    public GitRepositoryPage browse(Long installationRowId, String query, String filter, int page, int size,
                                    boolean refresh, Long projectId) {
        User user = access.requireUser();
        access.requireRead(user);
        Long tenantId = user.getTenant().getId();

        GitInstallation installation = installations.findById(installationRowId)
                .filter(row -> row.getTenantId().equals(tenantId) && Boolean.TRUE.equals(row.getIsActive()))
                .orElseThrow(GitIntegrationException::installationNotFound);
        if (installation.getStatus() != GitInstallationStatus.CONNECTED) {
            throw GitIntegrationException.installationBroken(installation.getStatus().name());
        }

        InstallationRepositoryCache.Result result = load(installation, refresh);

        String term = normalizeQuery(query);
        List<GitHubRepository> matching = result.snapshot().repositories().stream()
                .filter(matches(term))
                .toList();

        List<GitRepositoryItem> items = toItems(matching, tenantId, projectId);
        long linkedCount = items.stream().filter(item -> item.linkedProject() != null).count();
        long availableCount = items.stream().filter(GitRepositoryItem::selectable).count();

        Filter selected = parseFilter(filter);
        List<GitRepositoryItem> filtered = items.stream()
                .filter(item -> switch (selected) {
                    case AVAILABLE -> item.selectable();
                    case LINKED -> item.linkedProject() != null;
                    case ALL -> true;
                })
                .sorted(Comparator.comparing(GitRepositoryItem::selectable).reversed()
                        .thenComparing(item -> item.fullName().toLowerCase(Locale.ROOT)))
                .toList();

        int pageSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        int pageIndex = Math.max(page, 0);
        int from = Math.min(pageIndex * pageSize, filtered.size());
        int to = Math.min(from + pageSize, filtered.size());
        int totalPages = (int) Math.ceil(filtered.size() / (double) pageSize);

        return new GitRepositoryPage(
                new GitRepositoryPage.InstallationSummary(installation.getId(), installation.getAccountLogin(),
                        installation.getAccountType(), installation.getStatus()),
                filtered.subList(from, to), pageIndex, pageSize, filtered.size(), totalPages,
                new GitRepositoryPage.Counts(items.size(), availableCount, linkedCount),
                LocalDateTime.ofInstant(result.snapshot().fetchedAt(), clock.getZone()),
                result.fromCache(), result.snapshot().truncated());
    }

    /** GitHub failures become explicit errors; a broken installation is recorded (GI-02, {@link InstallationHealth}). */
    private InstallationRepositoryCache.Result load(GitInstallation installation, boolean refresh) {
        long installationId = installation.getInstallationId();
        try {
            return cache.get(installationId, refresh);
        } catch (GitHubApiException e) {
            throw failures.toBusinessError(installation, e, "list-repositories");
        }
    }

    private List<GitRepositoryItem> toItems(List<GitHubRepository> repositories, Long tenantId, Long projectId) {
        List<Long> ids = repositories.stream().map(GitHubRepository::id).filter(Objects::nonNull).toList();
        Map<Long, GitRepository> activeByExternalId = ids.isEmpty() ? Map.of()
                : repositoryConnections.findByProviderAndExternalIdInAndStatusIn(GitProvider.GITHUB, ids, GitRepositoryRepository.RECEIVING)
                .stream().collect(Collectors.toMap(GitRepository::getExternalId, Function.identity(), (first, second) -> first));
        Map<Long, Project> projectsById = activeByExternalId.isEmpty() ? Map.of()
                : projects.findAllById(activeByExternalId.values().stream().map(GitRepository::getProjectId).distinct().toList())
                .stream().collect(Collectors.toMap(Project::getId, Function.identity()));

        return repositories.stream().filter(repo -> repo.id() != null).map(repo -> {
            GitRepository link = activeByExternalId.get(repo.id());
            GitRepositoryItem.LinkedProject linkedProject = null;
            String reason = null;
            if (link != null) {
                Project project = projectsById.get(link.getProjectId());
                boolean sameTenant = project != null && tenantId.equals(project.getTenantId());
                linkedProject = new GitRepositoryItem.LinkedProject(link.getProjectId(),
                        sameTenant ? project.getCode() : null, sameTenant ? project.getName() : null);
                reason = link.getProjectId().equals(projectId) ? LINKED_TO_THIS_PROJECT : LINKED_TO_OTHER_PROJECT;
            } else if (Boolean.TRUE.equals(repo.disabled())) {
                reason = DISABLED;
            } else if (Boolean.TRUE.equals(repo.archived())) {
                reason = ARCHIVED;
            }
            return new GitRepositoryItem(repo.id(), repo.name(), repo.ownerLogin(), repo.fullName(), repo.htmlUrl(),
                    repo.resolvedVisibility(), repo.defaultBranch(), Boolean.TRUE.equals(repo.archived()),
                    linkedProject, reason == null, reason);
        }).toList();
    }

    private static Predicate<GitHubRepository> matches(String term) {
        if (term.isEmpty()) return repo -> true;
        return repo -> contains(repo.name(), term) || contains(repo.fullName(), term) || contains(repo.ownerLogin(), term);
    }

    private static boolean contains(String value, String term) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(term);
    }

    private static String normalizeQuery(String query) {
        if (query == null) return "";
        String trimmed = query.trim().toLowerCase(Locale.ROOT);
        return trimmed.length() > MAX_QUERY_LENGTH ? trimmed.substring(0, MAX_QUERY_LENGTH) : trimmed;
    }

    private static Filter parseFilter(String filter) {
        if (filter == null) return Filter.ALL;
        try {
            return Filter.valueOf(filter.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return Filter.ALL;
        }
    }
}
