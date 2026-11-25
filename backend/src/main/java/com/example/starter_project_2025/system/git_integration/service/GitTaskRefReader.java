package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLink;
import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReference;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceReason;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.dto.GitTaskRef;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkRepository;
import com.example.starter_project_2025.system.git_integration.repository.BacklogReferenceRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository.BacklogItemRow;
import com.example.starter_project_2025.system.git_integration.tasklink.BacklogItemDirectory;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * SY-05: the Task IDs of a page of commits or pull requests, in one query each for the
 * references, the links and the linked tasks. TM-03: each linked entry says whether the
 * link is AUTO or MANUAL, and MANUAL links of tasks the text does not name are listed too.
 */
@Component
@RequiredArgsConstructor
class GitTaskRefReader {

    private final BacklogReferenceRepository references;
    private final BacklogGitLinkRepository links;
    private final BacklogItemDirectory directory;

    Map<Long, List<GitTaskRef>> refsOf(GitArtifactType type, Collection<Long> sourceIds) {
        if (sourceIds.isEmpty()) return Map.of();
        List<BacklogReference> rows = references.findBySourceTypeAndSource_IdIn(type, sourceIds);
        // source id → task id → link
        Map<Long, Map<Long, BacklogGitLink>> linkOf = new HashMap<>();
        for (BacklogGitLink link : links.findByArtifactTypeAndArtifact_IdIn(type, sourceIds)) {
            linkOf.computeIfAbsent(link.getArtifactId(), id -> new HashMap<>()).put(link.getBacklogItemId(), link);
        }
        Map<Long, BacklogItemRow> items = directory.byIds(Stream.concat(
                        rows.stream().filter(row -> row.getStatus() == BacklogReferenceStatus.LINKED).map(BacklogReference::getBacklogItemId),
                        linkOf.values().stream().flatMap(byItem -> byItem.keySet().stream()))
                .filter(Objects::nonNull).distinct().toList());

        // WS-GH-02: project of each linked task, resolved once per task (a team-only task reads its workspace).
        Map<Long, Long> projectOfItem = new HashMap<>();
        Function<BacklogItemRow, Long> projectOf = item -> item == null ? null
                : projectOfItem.computeIfAbsent(item.getId(), id -> directory.projectOf(item));

        Map<Long, List<GitTaskRef>> result = new HashMap<>();
        Map<Long, Set<Long>> listed = new HashMap<>();
        rows.stream().sorted(Comparator.comparing(BacklogReference::getId)).forEach(row -> {
            BacklogGitLink link = row.getBacklogItemId() == null ? null
                    : linkOf.getOrDefault(row.getSourceId(), Map.of()).get(row.getBacklogItemId());
            result.computeIfAbsent(row.getSourceId(), id -> new ArrayList<>()).add(toRef(row, items, link, projectOf));
            if (link != null) listed.computeIfAbsent(row.getSourceId(), id -> new HashSet<>()).add(row.getBacklogItemId());
        });
        // MANUAL links of tasks the text does not (or no longer) name.
        linkOf.forEach((sourceId, byItem) -> byItem.values().stream()
                .filter(link -> link.getLinkSource() == BacklogLinkSource.MANUAL)
                .filter(link -> !listed.getOrDefault(sourceId, Set.of()).contains(link.getBacklogItemId()))
                .sorted(Comparator.comparing(BacklogGitLink::getId))
                .forEach(link -> {
                    BacklogItemRow item = items.get(link.getBacklogItemId());
                    if (item == null) return;
                    result.computeIfAbsent(sourceId, id -> new ArrayList<>()).add(new GitTaskRef(item.getTaskKey(), null,
                            BacklogReferenceStatus.LINKED, BacklogReferenceReason.OK, BacklogReferenceField.NONE,
                            item.getId(), item.getTitle(), item.getStatus() == null ? null : item.getStatus().name(),
                            BacklogLinkSource.MANUAL, projectOf.apply(item)));
                }));
        // A source linked to a task (manually, its text naming none) is not "No task ID".
        return result.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, entry -> {
            List<GitTaskRef> refs = entry.getValue();
            boolean linked = !linkOf.getOrDefault(entry.getKey(), Map.of()).isEmpty();
            return linked ? refs.stream().filter(ref -> ref.status() != BacklogReferenceStatus.MISSING).toList() : List.copyOf(refs);
        }));
    }

    private static GitTaskRef toRef(BacklogReference row, Map<Long, BacklogItemRow> items, BacklogGitLink link,
                                    Function<BacklogItemRow, Long> projectOf) {
        BacklogItemRow item = row.getStatus() == BacklogReferenceStatus.LINKED ? items.get(row.getBacklogItemId()) : null;
        return new GitTaskRef(
                BacklogReference.NO_KEY.equals(row.getRefKey()) ? null : row.getRefKey(),
                row.getRawText(),
                row.getStatus(),
                row.getReason(),
                row.getSourceField(),
                item == null ? null : item.getId(),
                item == null ? null : item.getTitle(),
                item == null || item.getStatus() == null ? null : item.getStatus().name(),
                link == null ? null : link.getLinkSource(),
                projectOf.apply(item));
    }
}
