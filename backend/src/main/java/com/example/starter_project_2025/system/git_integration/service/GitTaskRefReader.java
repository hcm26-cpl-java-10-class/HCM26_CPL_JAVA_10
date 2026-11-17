package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.BacklogReference;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.dto.GitTaskRef;
import com.example.starter_project_2025.system.git_integration.repository.BacklogReferenceRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository.BacklogItemRow;
import com.example.starter_project_2025.system.git_integration.tasklink.BacklogItemDirectory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/** SY-05: the Task IDs of a page of commits or pull requests, in one query (plus one for the linked task titles). */
@Component
@RequiredArgsConstructor
class GitTaskRefReader {

    private final BacklogReferenceRepository references;
    private final BacklogItemDirectory directory;

    Map<Long, List<GitTaskRef>> refsOf(GitArtifactType type, Collection<Long> sourceIds) {
        if (sourceIds.isEmpty()) return Map.of();
        List<BacklogReference> rows = references.findBySourceTypeAndSourceIdIn(type, sourceIds);
        Map<Long, BacklogItemRow> items = directory.byIds(rows.stream()
                .filter(row -> row.getStatus() == BacklogReferenceStatus.LINKED)
                .map(BacklogReference::getBacklogItemId).filter(Objects::nonNull).distinct().toList());
        return rows.stream()
                .sorted(Comparator.comparing(BacklogReference::getId))
                .collect(Collectors.groupingBy(BacklogReference::getSourceId,
                        Collectors.mapping(row -> toRef(row, items), Collectors.toList())));
    }

    private static GitTaskRef toRef(BacklogReference row, Map<Long, BacklogItemRow> items) {
        BacklogItemRow item = row.getStatus() == BacklogReferenceStatus.LINKED ? items.get(row.getBacklogItemId()) : null;
        return new GitTaskRef(
                BacklogReference.NO_KEY.equals(row.getRefKey()) ? null : row.getRefKey(),
                row.getRawText(),
                row.getStatus(),
                row.getReason(),
                row.getSourceField(),
                item == null ? null : item.getId(),
                item == null ? null : item.getTitle(),
                item == null || item.getStatus() == null ? null : item.getStatus().name());
    }
}
