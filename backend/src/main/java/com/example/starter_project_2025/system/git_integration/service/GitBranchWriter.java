package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitBranch;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubBranchPage;
import com.example.starter_project_2025.system.git_integration.ingestion.GitHubPayloadMapper;
import com.example.starter_project_2025.system.git_integration.repository.GitBranchRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * SY-07: the one writer of {@code git_branches}, used by the synchronization (branch listing,
 * branch imported) and by push webhooks. A head only moves forward in time, so a listing and a
 * push handled out of order never put an older head back. Callers outside a transaction wrap the
 * writes in {@code GitIngestionRetry.onConflict} (unique name key, {@code @Version}).
 */
@Service
public class GitBranchWriter {

    private static final String HEADS = "refs/heads/";
    private static final String ZERO_SHA = "0000000000000000000000000000000000000000";

    private final GitBranchRepository branches;
    private final GitEntityReferences references;
    private final GitHubPayloadMapper mapper;
    private final GitHubAppProperties properties;
    private final Clock clock;

    public GitBranchWriter(GitBranchRepository branches, GitEntityReferences references, GitHubPayloadMapper mapper,
                           GitHubAppProperties properties, @Qualifier("gitIntegrationClock") Clock clock) {
        this.branches = branches;
        this.references = references;
        this.mapper = mapper;
        this.properties = properties;
        this.clock = clock;
    }

    /** What a sync stores when a branch was read to the end (or to the page cap). */
    public record Synced(String headOid, Integer aheadBy, Integer behindBy, boolean truncated) {
    }

    /** One listed page: creates or refreshes the branches, marks them seen by {@code jobId}. */
    @Transactional
    public void upsertListed(GitRepository repository, Long jobId, String defaultBranch, List<GitHubBranchPage.Branch> listed) {
        if (listed.isEmpty()) return;
        Map<String, GitBranch> stored = branches.findByRepository_IdAndNameKeyIn(repository.getId(),
                        listed.stream().map(branch -> GitBranch.keyOf(branch.name())).toList()).stream()
                .collect(Collectors.toMap(GitBranch::getNameKey, Function.identity(), (a, b) -> a));
        List<GitBranch> changed = new ArrayList<>();
        for (GitHubBranchPage.Branch item : listed) {
            String key = GitBranch.keyOf(item.name());
            GitBranch row = stored.get(key);
            if (row == null) {
                row = newRow(repository, item.name());
                stored.put(key, row);
            }
            moveHead(row, item.headOid(), mapper.time(item.committedDate()));
            row.setDefaultBranch(item.name().equals(defaultBranch));
            row.setDeletedAt(null);
            row.setLastSeenJobId(jobId);
            changed.add(row);
        }
        branches.saveAll(changed);
    }

    /** After a complete listing: branches it did not see are gone from GitHub (their commits stay). */
    @Transactional
    public int markUnseenDeleted(Long repositoryId, Long jobId) {
        return branches.markUnseenDeleted(repositoryId, jobId, now());
    }

    /** GitHub no longer knows the branch (deleted or renamed while a sync read it). */
    @Transactional
    public void markGone(Long repositoryId, String name) {
        branches.findByRepository_IdAndNameKey(repositoryId, GitBranch.keyOf(name)).ifPresent(row -> {
            if (row.getDeletedAt() == null) row.setDeletedAt(now());
        });
    }

    /** Joins the caller's transaction: the last page of a branch and this mark are stored together. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void markSynced(Long repositoryId, String name, Synced synced) {
        branches.findByRepository_IdAndNameKey(repositoryId, GitBranch.keyOf(name)).ifPresent(row -> {
            row.setSyncedHeadOid(synced.headOid());
            row.setSyncedAt(now());
            row.setAheadBy(synced.aheadBy());
            row.setBehindBy(synced.behindBy());
            row.setTruncated(synced.truncated());
        });
    }

    /**
     * A push to {@code ref} stored its commits. The branch counts as imported up to {@code after}
     * only when it already was up to {@code before} and the push lost nothing: a branch created
     * before the repository was linked keeps its older commits to be read by the next sync.
     */
    @Transactional
    public void onPush(GitRepository repository, String ref, String before, String after, String headCommittedDate,
                       boolean complete) {
        String name = branchName(ref);
        if (name == null || isZero(after)) return;
        GitBranch row = branches.findByRepository_IdAndNameKey(repository.getId(), GitBranch.keyOf(name))
                .orElseGet(() -> newRow(repository, name));
        boolean continuous = complete && !isZero(before) && before.equals(row.getSyncedHeadOid());
        boolean moved = moveHead(row, after, mapper.time(headCommittedDate));
        if (moved && continuous) {
            row.setSyncedHeadOid(after);
            row.setSyncedAt(now());
        }
        row.setDeletedAt(null);
        branches.save(row);
    }

    /** A push deleted the branch. */
    @Transactional
    public void onDeleted(Long repositoryId, String ref) {
        String name = branchName(ref);
        if (name != null) markGone(repositoryId, name);
    }

    /** "Sync now": the branches cut at the page cap are read again (the cap may have been raised). */
    @Transactional
    public int resetTruncated(Long repositoryId) {
        return branches.resetTruncated(repositoryId);
    }

    /**
     * The branches a sync may read: existing on GitHub, not the default branch, not excluded,
     * at most {@code sync-max-branches} with the latest head commit first.
     */
    @Transactional(readOnly = true)
    public List<GitBranch> candidates(Long repositoryId, String defaultBranch) {
        List<Pattern> excluded = globs(properties.getSyncBranchExclude());
        return branches.findLive(repositoryId).stream()
                .filter(row -> !row.isDefault() && !row.getName().equals(defaultBranch))
                .filter(row -> excluded.stream().noneMatch(glob -> glob.matcher(row.getName()).matches()))
                .limit(properties.getSyncMaxBranches())
                .toList();
    }

    /** Glob to regex: {@code **} any text, {@code *} any text within a path segment, {@code ?} one character. */
    static List<Pattern> globs(Collection<String> globs) {
        if (globs == null) return List.of();
        List<Pattern> patterns = new ArrayList<>();
        for (String glob : globs) {
            if (glob == null || glob.isBlank()) continue;
            StringBuilder regex = new StringBuilder();
            String text = glob.trim();
            for (int i = 0; i < text.length(); i++) {
                char c = text.charAt(i);
                if (c == '*' && i + 1 < text.length() && text.charAt(i + 1) == '*') {
                    regex.append(".*");
                    i++;
                } else if (c == '*') {
                    regex.append("[^/]*");
                } else if (c == '?') {
                    regex.append("[^/]");
                } else {
                    regex.append(Pattern.quote(String.valueOf(c)));
                }
            }
            patterns.add(Pattern.compile(regex.toString()));
        }
        return patterns;
    }

    /** Sets the head unless the stored one is more recent; returns true when the stored head is now {@code oid}. */
    private static boolean moveHead(GitBranch row, String oid, LocalDateTime committedAt) {
        if (oid == null) return false;
        if (row.getHeadOid() != null && row.getHeadCommittedAt() != null && committedAt != null
                && committedAt.isBefore(row.getHeadCommittedAt())) {
            return oid.equals(row.getHeadOid());
        }
        row.setHeadOid(oid);
        if (committedAt != null) row.setHeadCommittedAt(committedAt);
        return true;
    }

    private GitBranch newRow(GitRepository repository, String name) {
        return GitBranch.builder()
                .tenant(references.get(Tenant.class, repository.getTenantId()))
                .repository(references.get(GitRepository.class, repository.getId()))
                .name(name)
                .nameKey(GitBranch.keyOf(name))
                .build();
    }

    private static String branchName(String ref) {
        if (ref == null || !ref.startsWith(HEADS) || ref.length() == HEADS.length()) return null;
        return ref.substring(HEADS.length());
    }

    private static boolean isZero(String sha) {
        return sha == null || sha.isBlank() || ZERO_SHA.equals(sha) || sha.chars().allMatch(c -> c == '0');
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock).truncatedTo(java.time.temporal.ChronoUnit.MICROS);
    }
}
