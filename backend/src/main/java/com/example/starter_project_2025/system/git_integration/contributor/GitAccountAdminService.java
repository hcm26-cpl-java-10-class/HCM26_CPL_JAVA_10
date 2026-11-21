package com.example.starter_project_2025.system.git_integration.contributor;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppCredentials;
import com.example.starter_project_2025.system.git_integration.domain.GitContributor;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountConnectResponse.GitAccountView;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountsOverview;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountsOverview.Activity;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountsOverview.EmailMapping;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountsOverview.GitHubMapping;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountsOverview.Member;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountsOverview.Unmapped;
import com.example.starter_project_2025.system.git_integration.dto.GitAccountsOverview.Viewer;
import com.example.starter_project_2025.system.git_integration.dto.GitContributorView;
import com.example.starter_project_2025.system.git_integration.dto.GitLinkDetails;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitContributorRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitProjectLookupRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.git_integration.repository.UserGitIdentityRepository;
import com.example.starter_project_2025.system.git_integration.service.GitIntegrationAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * GI-06: the GitHub accounts of a master project (Members view of the GitHub tab) and the PM's
 * changes: unlink a member's GitHub account (AC10), assign or unassign an e-mail-only
 * contributor (AC11). Activity is attributed when read, through {@code git_contributors}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitAccountAdminService {

    private final GitIntegrationAccessService access;
    private final GitAccountContextLoader contexts;
    private final GitAccountMappingWriter writer;
    private final GitContributorRegistry registry;
    private final GitContributorRepository contributors;
    private final UserGitIdentityRepository identities;
    private final GitInstallationRepository installations;
    private final GitProjectLookupRepository projects;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;
    private final UserRepository users;
    private final GitHubAppCredentials credentials;

    public GitAccountsOverview overview(Long projectId) {
        User user = access.requireUser();
        MasterContext context = contexts.load(user, projectId);
        if (!context.canView()) throw new AccessDeniedException("Viewing this project's GitHub accounts is not allowed");
        Long masterId = context.masterId();

        // Activity per identity, all time. Identities not in the directory yet (synchronized
        // before GI-06, or a missed event) are added first so they can be assigned.
        var commitRows = commits.authorActivity(masterId);
        var pullRequestRows = pullRequests.authorActivity(masterId);
        var reviewRows = reviews.reviewerActivity(masterId);

        List<GitContributor> rows = contributors.findByMasterProjectIdOrderByIdAsc(masterId);
        ContributorDirectory directory = new ContributorDirectory(rows);
        ContributorSightings sightings = new ContributorSightings();
        commitRows.forEach(row -> sightings.add(directory, row.getGithubId(), row.getEmail(), row.getLogin(), row.getName(),
                row.getFirstAt(), row.getLastAt()));
        pullRequestRows.forEach(row -> sightings.add(row.getGithubId(), null, row.getLogin(), null, row.getFirstAt(), row.getLastAt()));
        reviewRows.forEach(row -> sightings.add(row.getGithubId(), null, row.getLogin(), null, row.getFirstAt(), row.getLastAt()));
        Set<String> known = rows.stream().map(GitContributor::getIdentityKey).collect(Collectors.toSet());
        ContributorSightings missing = new ContributorSightings();
        sightings.all().stream().filter(seen -> !known.contains(seen.key()))
                .forEach(seen -> missing.add(seen.githubId(), seen.email(), seen.login(), seen.name(), seen.firstAt(), seen.lastAt()));
        if (!missing.isEmpty()) {
            registry.record(context.tenantId(), masterId, missing);
            rows = contributors.findByMasterProjectIdOrderByIdAsc(masterId);
        }

        ContributorDirectory current = new ContributorDirectory(rows);
        Map<String, long[]> counts = new HashMap<>();
        Map<String, java.time.LocalDateTime> lastAt = new HashMap<>();
        commitRows.forEach(row -> tally(counts, lastAt, row.getLogin(),
                ContributorSightings.keyOf(current, row.getGithubId(), row.getLogin(), row.getEmail()), 0, row.getCount(), row.getLastAt()));
        pullRequestRows.forEach(row -> tally(counts, lastAt, row.getLogin(),
                ContributorSightings.keyOf(current, row.getGithubId(), row.getLogin(), null), 1, row.getCount(), row.getLastAt()));
        reviewRows.forEach(row -> tally(counts, lastAt, row.getLogin(),
                ContributorSightings.keyOf(current, row.getGithubId(), row.getLogin(), null), 2, row.getCount(), row.getLastAt()));

        Map<Long, Activity> activityOf = new HashMap<>();
        for (GitContributor row : rows) {
            long[] c = counts.get(row.getIdentityKey());
            activityOf.put(row.getId(), c == null ? Activity.NONE : new Activity(c[0], c[1], c[2], lastAt.get(row.getIdentityKey())));
        }

        Map<Long, List<GitContributor>> byUser = rows.stream().filter(row -> row.getUserId() != null)
                .collect(Collectors.groupingBy(GitContributor::getUserId));
        Set<Long> userIds = new HashSet<>(byUser.keySet());
        rows.stream().map(GitContributor::getMappedByUserId).filter(Objects::nonNull).forEach(userIds::add);
        Map<Long, User> usersById = users.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, Function.identity()));

        Set<Long> projectIds = new LinkedHashSet<>();
        context.members().forEach(member -> projectIds.addAll(member.projectIds()));
        Map<Long, GitLinkDetails.ProjectSummary> projectsById = projectIds.isEmpty() ? Map.of()
                : projects.findAllByIds(projectIds).stream()
                .collect(Collectors.toMap(p -> p.getId(), com.example.starter_project_2025.system.git_integration.service.GitProjectResolver::summary));

        List<Member> members = new ArrayList<>();
        for (GitProjectMembership.Member member : context.members()) {
            members.add(member(member.userId(), member.name(), member.email(), new ArrayList<>(member.roles()),
                    member.projectIds().stream().map(projectsById::get).filter(Objects::nonNull).toList(), true,
                    byUser.getOrDefault(member.userId(), List.of()), activityOf, usersById));
        }
        for (var entry : byUser.entrySet()) { // mapped people who left the project keep their activity visible
            if (context.isMember(entry.getKey())) continue;
            User former = usersById.get(entry.getKey());
            members.add(member(entry.getKey(), former == null ? "#" + entry.getKey() : fullName(former),
                    former == null ? null : former.getEmail(), List.of(), List.of(), false, entry.getValue(), activityOf, usersById));
        }
        // Not connected first, then the most active, then by name.
        members.sort(Comparator.comparing((Member m) -> !m.member())
                .thenComparing(m -> m.github() != null)
                .thenComparing(Comparator.comparingLong((Member m) -> m.activity().commits() + m.activity().pullRequests()
                        + m.activity().reviews()).reversed())
                .thenComparing(m -> ContributorIdentity.normalizeName(m.name())));

        List<Unmapped> unmapped = rows.stream()
                .filter(row -> row.getUserId() == null && !activityOf.get(row.getId()).isEmpty())
                .map(row -> new Unmapped(row.getId(), kind(row), row.getLogin(), row.getEmail(), row.getDisplayName(),
                        activityOf.get(row.getId()), row.isGitHub() ? null : suggestion(row, context.members())))
                .sorted(Comparator.comparing((Unmapped u) -> u.activity().lastActiveAt(), Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        long connected = members.stream().filter(m -> m.member() && m.github() != null).count();
        return new GitAccountsOverview(context.summary(), viewer(user, context, byUser), members, unmapped,
                new GitAccountsOverview.Summary(context.members().size(), connected, unmapped.size()));
    }

    /** AC10: the PM (or the member themselves) unlinks a member's GitHub account in the master project. */
    public void unlink(Long projectId, Long userId) {
        User user = access.requireUser();
        MasterContext context = contexts.load(user, projectId);
        if (!user.getId().equals(userId) && !context.canManage()) {
            throw new AccessDeniedException("Unlinking another member's GitHub account is not allowed");
        }
        writer.unlinkGitHub(context.tenantId(), context.masterId(), userId);
        log.info("GitHub account unlinked: tenantId={}, masterId={}, memberId={}, byUserId={}",
                context.tenantId(), context.masterId(), userId, user.getId());
    }

    /** AC11: the PM assigns an e-mail-only contributor to a member. */
    public GitContributorView assign(Long projectId, Long contributorId, Long memberId) {
        User user = access.requireUser();
        MasterContext context = requireManage(user, projectId);
        if (!context.isMember(memberId)) throw GitIntegrationException.assigneeNotMember();
        GitContributor row = writer.assign(context.tenantId(), context.masterId(), contributorId, memberId, user.getId());
        log.info("Contributor assigned: tenantId={}, masterId={}, contributorId={}, memberId={}, byUserId={}",
                context.tenantId(), context.masterId(), contributorId, memberId, user.getId());
        return view(row);
    }

    public GitContributorView unassign(Long projectId, Long contributorId) {
        User user = access.requireUser();
        MasterContext context = requireManage(user, projectId);
        GitContributor row = writer.unassign(context.tenantId(), context.masterId(), contributorId);
        log.info("Contributor unassigned: tenantId={}, masterId={}, contributorId={}, byUserId={}",
                context.tenantId(), context.masterId(), contributorId, user.getId());
        return view(row);
    }

    // ---- helpers ---------------------------------------------------------------------------------

    private MasterContext requireManage(User user, Long projectId) {
        MasterContext context = contexts.load(user, projectId);
        if (!context.canManage()) throw new AccessDeniedException("Managing the project's GitHub accounts is not allowed");
        return context;
    }

    private static void tally(Map<String, long[]> counts, Map<String, java.time.LocalDateTime> lastAt, String login,
                              String key, int index, Long count, java.time.LocalDateTime at) {
        if (key == null || ContributorIdentity.isBot(login)) return;
        counts.computeIfAbsent(key, ignored -> new long[3])[index] += count == null ? 0 : count;
        lastAt.merge(key, at, ContributorSightings::latest);
    }

    private Viewer viewer(User user, MasterContext context, Map<Long, List<GitContributor>> byUser) {
        GitAccountView identity = identities.findByUserIdAndProvider(user.getId(), GitProvider.GITHUB)
                .map(row -> new GitAccountView(row.getExternalUserId(), row.getLogin(), row.getAvatarUrl()))
                .orElseGet(() -> installations
                        .findFirstByConnectedByUserIdAndTenantIdAndProviderAndGithubUserIdIsNotNullOrderByConnectedAtDesc(
                                user.getId(), context.tenantId(), GitProvider.GITHUB)
                        .filter(row -> identities.findByProviderAndExternalUserId(GitProvider.GITHUB, row.getGithubUserId()).isEmpty())
                        .map(GitAccountAdminService::installationAccount)
                        .orElse(null));
        boolean mapped = byUser.getOrDefault(user.getId(), List.of()).stream().anyMatch(GitContributor::isGitHub);
        boolean member = context.isMember(user.getId());
        return new Viewer(user.getId(), identity, mapped, member && credentials.isEnabled(), context.canManage());
    }

    private static GitAccountView installationAccount(GitInstallation row) {
        return new GitAccountView(row.getGithubUserId(), row.getGithubUserLogin(), null);
    }

    private static Member member(Long userId, String name, String email, List<String> roles, List<GitLinkDetails.ProjectSummary> projects,
                                 boolean isMember, List<GitContributor> mapped, Map<Long, Activity> activityOf, Map<Long, User> usersById) {
        GitHubMapping github = mapped.stream().filter(GitContributor::isGitHub).findFirst()
                .map(row -> new GitHubMapping(row.getId(), row.getLogin(), row.getMapSource(), row.getMappedAt()))
                .orElse(null);
        List<EmailMapping> emails = mapped.stream().filter(row -> !row.isGitHub())
                .map(row -> {
                    User by = usersById.get(row.getMappedByUserId());
                    return new EmailMapping(row.getId(), row.getEmail(), by == null ? null : fullName(by), row.getMappedAt());
                })
                .toList();
        Activity activity = mapped.stream().map(row -> activityOf.getOrDefault(row.getId(), Activity.NONE))
                .reduce(Activity.NONE, Activity::plus);
        return new Member(userId, name, email, roles, projects, isMember, github, emails, activity);
    }

    /** A member whose e-mail is the commit e-mail, else the only member whose name is the commit name. */
    static Long suggestion(GitContributor row, List<GitProjectMembership.Member> members) {
        if (row.getEmail() != null) {
            for (GitProjectMembership.Member member : members) {
                if (row.getEmail().equalsIgnoreCase(member.email())) return member.userId();
            }
        }
        String name = ContributorIdentity.normalizeName(row.getDisplayName());
        if (name.isEmpty()) return null;
        List<Long> sameName = members.stream()
                .filter(member -> ContributorIdentity.normalizeName(member.name()).equals(name))
                .map(GitProjectMembership.Member::userId)
                .toList();
        return sameName.size() == 1 ? sameName.get(0) : null;
    }

    private static GitContributorView.Kind kind(GitContributor row) {
        return row.isGitHub() ? GitContributorView.Kind.GITHUB : GitContributorView.Kind.EMAIL;
    }

    static GitContributorView view(GitContributor row) {
        return new GitContributorView(row.getId(), kind(row), row.getLogin(), row.getEmail(), row.getDisplayName(),
                row.getUserId(), row.getMapSource(), row.getMappedAt());
    }

    static String fullName(User user) {
        String name = ((user.getFirstName() == null ? "" : user.getFirstName()) + " "
                + (user.getLastName() == null ? "" : user.getLastName())).trim();
        return name.isEmpty() ? user.getEmail() : name;
    }
}
