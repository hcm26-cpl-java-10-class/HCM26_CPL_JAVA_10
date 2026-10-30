package com.example.starter_project_2025.system.project.template.version;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.template.*;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TemplateVersionListService {
    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository versions;
    private final TemplateVersionConfigurationService configurations;
    private final TemplateTeamConstraintsMapper teams;
    private final ProjectTemplateAccessService access;

    public Page<TemplateVersionListItem> getPage(String search, ProjectTemplateStatus status,
            ProjectTemplateLevel level, String category, Pageable pageable) {
        var user = access.requireUser("READ");
        Specification<ProjectTemplate> readable = (root, query, builder) -> builder.and(
                builder.isTrue(root.get("isActive")),
                builder.or(builder.isNull(root.get("tenantId")), builder.equal(root.get("tenantId"), user.getTenantId())),
                builder.or(builder.isNull(root.get("code")), builder.notEqual(root.get("code"), "MANUAL-GROUPING-DEFAULT")));
        var owners = templates.findAll(readable);
        Map<Long, List<ProjectTemplateSnapshot>> byTemplate = new LinkedHashMap<>();
        if (!owners.isEmpty()) {
            for (var version : versions.findAllByTemplateIdInAndProjectIdIsNullAndIsActiveTrueOrderByCreatedAtDescIdDesc(
                    owners.stream().map(ProjectTemplate::getId).toList())) {
                if (configurations.isReusableVersion(version)) {
                    byTemplate.computeIfAbsent(version.getTemplateId(), key -> new ArrayList<>()).add(version);
                }
            }
        }
        List<TemplateVersionListItem> rows = new ArrayList<>();
        for (var owner : owners) {
            var history = byTemplate.getOrDefault(owner.getId(), List.of());
            if (history.isEmpty()) {
                rows.add(new TemplateVersionListItem(ProjectTemplateResponse.from(owner, access.can(user, "UPDATE"),
                        teams.read(owner.getConstraintsJson())), null, "v" + owner.getTemplateVersion() + ".0", true, owner.getStatus()));
            } else {
                for (int index = 0; index < history.size(); index++) {
                    rows.add(configurations.listItem(owner, history.get(index), user, index == 0));
                }
            }
        }
        String keyword = search == null ? "" : search.strip().toLowerCase(Locale.ROOT);
        var result = rows.stream()
                .filter(row -> status == null || row.template().status() == status)
                .filter(row -> level == null || row.template().level() == level)
                .filter(row -> category == null || category.isBlank() || category.strip().equals(row.template().category()))
                .filter(row -> keyword.isEmpty() || contains(row.template().code(), keyword)
                        || contains(row.template().name(), keyword) || contains(row.versionLabel(), keyword))
                .sorted(comparator(pageable.getSort()))
                .toList();
        int start = (int) Math.min(pageable.getOffset(), result.size());
        int end = Math.min(start + pageable.getPageSize(), result.size());
        return new PageImpl<>(result.subList(start, end), pageable, result.size());
    }

    private boolean contains(String value, String keyword) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(keyword);
    }

    private Comparator<TemplateVersionListItem> comparator(Sort sort) {
        Comparator<TemplateVersionListItem> result = (left, right) -> 0;
        for (var order : sort) {
            Comparator<TemplateVersionListItem> field = switch (order.getProperty()) {
                case "id" -> by(ProjectTemplateResponse::id);
                case "code" -> by(ProjectTemplateResponse::code);
                case "name" -> by(ProjectTemplateResponse::name);
                case "status" -> by(ProjectTemplateResponse::status);
                case "category" -> by(ProjectTemplateResponse::category);
                case "level" -> by(ProjectTemplateResponse::level);
                case "estimatedDurationWeeks" -> by(ProjectTemplateResponse::estimatedDurationWeeks);
                case "templateVersion" -> by(ProjectTemplateResponse::templateVersion);
                case "createdAt" -> by(ProjectTemplateResponse::createdAt);
                case "updatedAt" -> by(ProjectTemplateResponse::updatedAt);
                default -> throw new ProjectTemplateException(422, "Invalid sort field", Map.of());
            };
            result = result.thenComparing(order.isAscending() ? field : field.reversed());
        }
        return result.thenComparing(row -> row.versionId() == null ? row.template().id() : row.versionId(), Comparator.reverseOrder());
    }

    private <T extends Comparable<? super T>> Comparator<TemplateVersionListItem> by(Function<ProjectTemplateResponse, T> field) {
        return Comparator.comparing(row -> field.apply(row.template()), Comparator.nullsLast(Comparator.naturalOrder()));
    }
}
