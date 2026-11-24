package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequest;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReviewState;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestState;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLink;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLinkSource;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitContributorRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignmentRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Repeatable local fixtures shipped with source code, never with a developer's H2 database. */
@Component
@RequiredArgsConstructor
public class GitActivityDemoExpansion {
    static final int COMMITS_PER_PROJECT = 36;
    static final int PULL_REQUESTS_PER_PROJECT = 12;
    private static final List<String> CHANGES = List.of(
            "thêm màn hình danh sách", "kiểm tra dữ liệu đầu vào", "hoàn thiện API chi tiết",
            "sửa bộ lọc tìm kiếm", "bổ sung kiểm thử phân quyền", "cập nhật hướng dẫn cài đặt",
            "xử lý trạng thái đang tải", "tối ưu truy vấn dữ liệu", "thêm xác nhận thao tác",
            "sửa hiển thị trên điện thoại", "bổ sung thông báo lỗi", "hoàn thiện luồng tích hợp");
    private static final List<String> TYPES = List.of("feat", "fix", "feat", "fix", "test", "docs",
            "feat", "refactor", "feat", "fix", "fix", "test");
    private final ProjectRepository projects;
    private final ProjectTeamRepository teams;
    private final TeamSubprojectAssignmentRepository assignments;
    private final ProjectMemberRepository members;
    private final SprintBacklogRepository tasks;
    private final GitRepositoryRepository repositories;
    private final GitContributorRepository contributors;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;
    private final TaskGitLinkRepository links;

    void seed(Project root, List<Long> projectIds) {
        List<GitRepository> sources = repositories.findAllByRootProject_IdOrderByIdAsc(root.getId());
        if (sources.stream().anyMatch(source -> !source.isMockData())) return;
        GitRepository repository = sources.stream().filter(GitRepository::isMockData).findFirst().orElse(null);
        if (repository == null) return;

        Set<String> existingShas = commits.findAllByRepository_IdOrderByCommittedAtAscIdAsc(repository.getId())
                .stream().map(GitCommit::getSha).collect(Collectors.toCollection(HashSet::new));
        Map<Long, List<SprintBacklog>> tasksByProject = tasks
                .findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(projectIds).stream()
                .collect(Collectors.groupingBy(SprintBacklog::getProjectId));
        Instant today = Instant.now().minus(2, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MINUTES);
        for (Project project : projects.findAllById(projectIds)) {
            if (!Boolean.TRUE.equals(project.getIsActive()) || !Objects.equals(project.getTenantId(), root.getTenantId())) continue;
            List<SprintBacklog> projectTasks = tasksByProject.getOrDefault(project.getId(), List.of());
            if (projectTasks.isEmpty()) projectTasks = createSampleTasks(project);
            List<GitContributor> authors = projectContributors(root, project);
            seedCommits(repository, project, projectTasks, authors, existingShas, today);
            seedPullRequests(repository, project, projectTasks, authors, today);
        }
    }

    private List<SprintBacklog> createSampleTasks(Project project) {
        List<SprintBacklog> result = new ArrayList<>();
        for (String title : List.of("Thiết kế API", "Xây dựng giao diện", "Kiểm thử tích hợp")) {
            SprintBacklog task = new SprintBacklog();
            task.setProjectId(project.getId());
            task.setTitle("Git demo: " + title);
            task.setDescription("Dữ liệu mẫu Git Activity để thử liên kết commit và pull request với công việc.");
            task.setStatus(SprintBacklogStatus.TODO);
            result.add(tasks.saveAndFlush(task));
        }
        return result;
    }

    private List<GitContributor> projectContributors(Project root, Project project) {
        Set<Long> teamIds = new LinkedHashSet<>();
        teams.findAllByProject_IdInOrderByIdDesc(List.of(project.getId())).forEach(team -> teamIds.add(team.getId()));
        assignments.findAllByProject_IdAndIsActiveTrueOrderByIdAsc(project.getId())
                .forEach(assignment -> teamIds.add(assignment.getTeam().getId()));
        Map<Long, User> users = new LinkedHashMap<>();
        for (Long teamId : teamIds) {
            members.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(teamId, ClassMemberStatus.ACTIVE).stream()
                    .filter(member -> Boolean.TRUE.equals(member.getIsActive())
                            && Boolean.TRUE.equals(member.getClassMember().getIsActive()))
                    .map(member -> member.getClassMember().getUser()).filter(Objects::nonNull)
                    .filter(user -> user.getTenant() != null && Objects.equals(user.getTenant().getId(), root.getTenantId()))
                    .forEach(user -> users.putIfAbsent(user.getId(), user));
        }
        List<GitContributor> result = new ArrayList<>();
        for (User user : users.values()) {
            result.add(contributor(root, 8_000_000_000_000L + user.getId(), "demo-member-" + user.getId(),
                    user.getFullName(), user, false));
        }
        if (result.isEmpty()) {
            List<String> names = List.of("Nguyễn Minh Anh", "Trần Gia Bảo", "Lê Thảo Vy", "Phạm Quốc Huy");
            for (int i = 0; i < names.size(); i++) {
                result.add(contributor(root, 7_000_000_000_000L + i, "demo-contributor-" + (i + 1), names.get(i), null, false));
            }
        }
        return result;
    }

    private GitContributor contributor(Project root, long externalId, String login, String name, User user, boolean bot) {
        return contributors.findFirstByRootProject_IdAndExternalId(root.getId(), externalId).orElseGet(() -> {
            GitContributor contributor = new GitContributor();
            contributor.setRootProject(root);
            contributor.setExternalId(externalId);
            contributor.setLogin(login);
            contributor.setDisplayName(name);
            contributor.setUser(user);
            contributor.setBot(bot);
            return contributors.saveAndFlush(contributor);
        });
    }

    private void seedCommits(GitRepository repository, Project project, List<SprintBacklog> projectTasks,
                             List<GitContributor> authors, Set<String> existingShas, Instant today) {
        Project root = repository.getRootProject();
        GitContributor guest = contributor(root, 7_100_000_000_000L, "demo-minh-khang", "Vũ Minh Khang", null, false);
        GitContributor bot = contributor(root, 7_200_000_000_000L, "demo-dependabot", "dependabot[bot]", null, true);
        for (int i = 0; i < COMMITS_PER_PROJECT; i++) {
            String key = "git-activity-demo-v2:" + project.getId() + ":commit:" + i;
            String sha = "de00cafe" + UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)).toString().replace("-", "");
            if (existingShas.contains(sha)) continue;
            SprintBacklog task = projectTasks.get(i % projectTasks.size());
            String message = TYPES.get(i % TYPES.size()) + "(module): " + CHANGES.get(i % CHANGES.size())
                    + " · " + project.getName() + " TASK-" + task.getId();
            // Include good messages, missing/invalid Task IDs, merge commits and bots for the filters.
            if (i % 12 == 8) message = "update module " + project.getName();
            if (i % 12 == 9) message = "fix(module): xử lý thông báo TASK-999999999";
            GitCommit commit = new GitCommit();
            commit.setRepository(repository);
            commit.setSha(sha);
            commit.setMessage(message);
            commit.setAuthorContributor(i % 12 == 11 ? bot : i % 12 == 7 ? guest : authors.get(i % authors.size()));
            commit.setCommittedAt(today.minus(40 - i * 40L / (COMMITS_PER_PROJECT - 1), ChronoUnit.DAYS)
                    .minus(i % 8, ChronoUnit.HOURS));
            commit.setFirstSeenBranch(i % 6 == 0 ? "main" : "feature/module-" + project.getId() + "-" + (i % 4 + 1));
            commit.setBot(i % 12 == 11);
            commit.setMergeCommit(i % 12 == 10);
            commit = commits.saveAndFlush(commit);
            // A few unlinked commits exercise the unmapped-activity screen; linked ones remain module-scoped.
            if (i % 12 != 10) link(task, commit, null, commit.getCommittedAt());
            existingShas.add(sha);
        }
    }

    private void seedPullRequests(GitRepository repository, Project project, List<SprintBacklog> projectTasks,
                                  List<GitContributor> authors, Instant today) {
        for (int i = 0; i < PULL_REQUESTS_PER_PROJECT; i++) {
            long externalId = 6_000_000_000_000L + project.getId() * 100 + i;
            if (pullRequests.findFirstByRepository_IdAndExternalId(repository.getId(), externalId).isPresent()) continue;
            SprintBacklog task = projectTasks.get(i % projectTasks.size());
            GitContributor author = authors.get(i % authors.size());
            GitPullRequestState state = i % 4 < 2 ? GitPullRequestState.MERGED
                    : i % 4 == 2 ? GitPullRequestState.OPEN : GitPullRequestState.CLOSED;
            Instant created = today.minus(35 - i * 3L, ChronoUnit.DAYS);
            Instant updated = created.plus(28 + i, ChronoUnit.HOURS);
            GitPullRequest pr = new GitPullRequest();
            pr.setRepository(repository);
            pr.setExternalId(externalId);
            pr.setNumber(Math.toIntExact(1_000 + project.getId() * 100 + i));
            pr.setTitle(TYPES.get(i) + "(module): " + CHANGES.get(i) + " · " + project.getName());
            pr.setBody("Dữ liệu mẫu Git Activity.\n\nCông việc: TASK-" + task.getId()
                    + "\nThay đổi: " + CHANGES.get(i) + ".\nĐã kiểm tra luồng chính và các trường hợp nhập sai dữ liệu.");
            pr.setAuthorContributor(author);
            pr.setState(state);
            pr.setDraft(state == GitPullRequestState.OPEN && i % 8 == 6);
            pr.setSourceBranch("feature/module-" + project.getId() + "-" + (i % 4 + 1));
            pr.setTargetBranch(i % 3 == 0 ? "develop" : "main");
            pr.setCreatedAt(created);
            pr.setSourceUpdatedAt(updated);
            pr.setMergedAt(state == GitPullRequestState.MERGED ? updated : null);
            pr.setClosedAt(state == GitPullRequestState.OPEN ? null : updated);
            pr.setFirstReviewAt(created.plus(2 + i % 8, ChronoUnit.HOURS));
            pr = pullRequests.saveAndFlush(pr);
            link(task, null, pr, created);
            for (int reviewIndex = 0; reviewIndex < 2; reviewIndex++) {
                GitContributor reviewer = authors.get((i + reviewIndex + 1) % authors.size());
                GitPullRequestReview review = new GitPullRequestReview();
                review.setPullRequest(pr);
                review.setExternalId(externalId * 10 + reviewIndex);
                review.setReviewerContributor(reviewer);
                review.setState(reviewIndex == 1 && state == GitPullRequestState.MERGED ? GitPullRequestReviewState.APPROVED
                        : GitPullRequestReviewState.values()[(i + reviewIndex) % GitPullRequestReviewState.values().length]);
                review.setSubmittedAt(pr.getFirstReviewAt().plus(reviewIndex * 8L, ChronoUnit.HOURS));
                review.setSourceUpdatedAt(review.getSubmittedAt());
                review.setSelfReview(Objects.equals(author.getId(), reviewer.getId()));
                reviews.save(review);
            }
        }
    }

    private void link(SprintBacklog task, GitCommit commit, GitPullRequest pullRequest, Instant at) {
        TaskGitLink link = new TaskGitLink();
        link.setTask(task);
        link.setCommit(commit);
        link.setPullRequest(pullRequest);
        link.setSource(TaskGitLinkSource.AUTO);
        link.setLinkedAt(at);
        links.save(link);
    }
}
