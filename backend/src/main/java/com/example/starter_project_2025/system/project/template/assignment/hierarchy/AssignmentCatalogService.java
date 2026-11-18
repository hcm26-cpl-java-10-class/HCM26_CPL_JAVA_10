package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateConstraints;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.TreeSet;

/**
 * Read side of the "assign master project" screen: the searchable catalogue of published master templates and the
 * read-only problem statement (brief) of one of them. Every value is read from the published snapshot that would be
 * assigned, never from the editable template row, so what the assigner reads is exactly what the teams receive.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AssignmentCatalogService {
    public static final int DEFAULT_PAGE_SIZE = 12;
    public static final int MAX_PAGE_SIZE = 50;
    private static final int MAX_SEARCH_LENGTH = 100;

    public enum Sort { NAME, CODE, RECENT }

    /** Catalogue query; {@code fit} keeps templates whose team size suits {@code teamId} or any team of the session. */
    public record Filter(String search, String category, String level, boolean fit, Long teamId, Sort sort,
                         int page, int size) {
        public Filter {
            search = normalize(search);
            if (search.length() > MAX_SEARCH_LENGTH) search = search.substring(0, MAX_SEARCH_LENGTH);
            category = normalize(category);
            level = normalize(level).toUpperCase(Locale.ROOT);
            sort = sort == null ? Sort.NAME : sort;
            page = Math.max(page, 0);
            size = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        }

        private static String normalize(String value) {
            return value == null ? "" : value.strip();
        }
    }

    private record Candidate(ProjectTemplate template, ProjectTemplateSnapshot version, ObjectNode content,
                             ProjectTemplateConstraints.Capacity capacity) {
        String code() { return text(content, "code", template.getCode()); }
        String name() { return text(content, "name", template.getName()); }
        String category() { return text(content, "category", template.getCategory()); }
        String level() { return text(content, "level", null); }
        String technologyStack() { return text(content, "technologyStack", null); }
    }

    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository versions;
    private final ProjectTeamRepository teams;
    private final AssignmentValidationService validation;
    private final AssignmentTemplateReader reader;
    private final ProjectAssignmentService assignments;
    private final RubricCatalogService rubrics;
    private final ObjectMapper json;

    public AssignmentDtos.Catalog catalog(Long classId, Long sessionId, Filter filter, Authentication authentication) {
        var session = validation.session(classId, sessionId, authentication, false);
        var trainingClass = session.getTrainingClass();
        List<Candidate> published = publishedMasters(trainingClass.getTenantId());
        Set<String> categories = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        published.stream().map(Candidate::category).filter(Objects::nonNull).forEach(categories::add);

        Set<Integer> teamSizes = filter.fit() ? teamSizes(sessionId, filter.teamId()) : Set.of();
        String keyword = filter.search().toLowerCase(Locale.ROOT);
        List<Candidate> matches = published.stream()
                .filter(candidate -> keyword.isEmpty() || haystack(candidate).contains(keyword))
                .filter(candidate -> filter.category().isEmpty() || filter.category().equalsIgnoreCase(candidate.category()))
                .filter(candidate -> filter.level().isEmpty() || filter.level().equals(candidate.level()))
                .filter(candidate -> !filter.fit() || teamSizes.stream().anyMatch(size ->
                        size >= candidate.capacity().minMembers() && size <= candidate.capacity().maxMembers()))
                .sorted(comparator(filter.sort()))
                .toList();

        int from = (int) Math.min((long) filter.page() * filter.size(), matches.size());
        int to = Math.min(from + filter.size(), matches.size());
        List<AssignmentDtos.TemplateSummary> items = matches.subList(from, to).stream()
                .map(candidate -> summary(candidate, assignedTeams(trainingClass, candidate)))
                .toList();
        return new AssignmentDtos.Catalog(items, matches.size(), filter.page(), filter.size(), List.copyOf(categories));
    }

    public AssignmentDtos.Brief brief(Long classId, Long sessionId, Long templateId, Long versionId,
                                      Authentication authentication) {
        var session = validation.session(classId, sessionId, authentication, false);
        Long tenantId = session.getTrainingClass().getTenantId();
        var root = reader.load(templateId, versionId, tenantId);
        var published = versions.findById(root.sourceVersionId()).orElseThrow();
        Map<UUID, Optional<AssignmentDtos.BriefRubric>> rubricCache = new HashMap<>();
        return new AssignmentDtos.Brief(root.templateId(), root.sourceVersionId(), root.version(),
                text(root.content(), "category", null), published.getUpdatedAt(), briefNode(root, tenantId, rubricCache));
    }

    private List<Candidate> publishedMasters(Long tenantId) {
        List<ProjectTemplate> masters = templates.findAllByTenantIdAndParentTemplateIsNullAndStatusAndIsActiveTrue(
                tenantId, ProjectTemplateStatus.ACTIVE);
        if (masters.isEmpty()) return List.of();
        Map<Long, ProjectTemplateSnapshot> latest = new LinkedHashMap<>();
        versions.findAllByTemplateIdInAndStatusAndIsActiveTrueOrderByCreatedAtDesc(
                        masters.stream().map(ProjectTemplate::getId).toList(), ProjectTemplateVersionStatus.PUBLISHED)
                .forEach(version -> latest.putIfAbsent(version.getTemplateId(), version));
        List<Candidate> result = new ArrayList<>();
        for (ProjectTemplate master : masters) {
            ProjectTemplateSnapshot version = latest.get(master.getId());
            // Same rule as AssignmentTemplateReader#load: only a library (non project) version can be assigned.
            if (version == null || version.getProjectId() != null) continue;
            try {
                if (!(json.readTree(version.getContentJson()) instanceof ObjectNode content)) continue;
                result.add(new Candidate(master, version, content, reader.capacity(content)));
            } catch (Exception exception) {
                // A corrupt snapshot cannot be assigned either; it must not hide the rest of the catalogue.
                log.warn("Skipping master template {} version {} in the assignment catalogue: {}",
                        master.getId(), version.getId(), exception.getMessage());
            }
        }
        return result;
    }

    private Set<Integer> teamSizes(Long sessionId, Long teamId) {
        Set<Integer> sizes = new LinkedHashSet<>();
        teams.findAllByAllocationSession_IdOrderByIdAsc(sessionId).stream()
                .filter(team -> Boolean.TRUE.equals(team.getIsActive()) && team.getStatus() != ProjectTeamStatus.ARCHIVED)
                .filter(team -> teamId == null || teamId.equals(team.getId()))
                .forEach(team -> sizes.add(validation.activeMembers(team).size()));
        return sizes;
    }

    private List<String> assignedTeams(com.example.starter_project_2025.system.project.trainingclass.TrainingClass trainingClass,
                                       Candidate candidate) {
        Set<Long> ids = new LinkedHashSet<>();
        ids.add(candidate.template().getId());
        collectTemplateIds(candidate.content().path("modules"), ids);
        try {
            return assignments.ownersOf(trainingClass, candidate.template().getId(), ids).stream()
                    .map(AssignmentDtos.Owner::teamName).distinct().toList();
        } catch (RuntimeException exception) {
            // Ownership is advisory on the card; the preview re-checks it before anything can be assigned.
            log.warn("Unable to resolve class owners of master template {}: {}",
                    candidate.template().getId(), exception.getMessage());
            return List.of();
        }
    }

    private static void collectTemplateIds(JsonNode modules, Set<Long> ids) {
        if (!modules.isArray()) return;
        for (JsonNode module : modules) {
            if (module.path("templateId").canConvertToLong()) ids.add(module.path("templateId").asLong());
            collectTemplateIds(module.path("modules"), ids);
        }
    }

    private AssignmentDtos.TemplateSummary summary(Candidate candidate, List<String> assignedTeams) {
        Integer duration = integer(candidate.content(), "estimatedDurationWeeks");
        return new AssignmentDtos.TemplateSummary(candidate.template().getId(), candidate.version().getId(),
                candidate.version().getVersion(), candidate.code(), candidate.name(), candidate.category(),
                candidate.level(), duration, candidate.technologyStack(),
                candidate.content().path("modules").size(), milestoneCount(candidate.content()),
                candidate.capacity().minMembers(), candidate.capacity().maxMembers(),
                candidate.version().getUpdatedAt(), assignedTeams);
    }

    private static int milestoneCount(JsonNode content) {
        int count = content.path("milestones").size();
        for (JsonNode module : content.path("modules")) count += milestoneCount(module);
        return count;
    }

    private static String haystack(Candidate candidate) {
        return String.join(" ", Objects.toString(candidate.code(), ""), Objects.toString(candidate.name(), ""),
                Objects.toString(candidate.technologyStack(), "")).toLowerCase(Locale.ROOT);
    }

    private static Comparator<Candidate> comparator(Sort sort) {
        Comparator<Candidate> byName = Comparator.comparing(candidate -> Objects.toString(candidate.name(), ""),
                String.CASE_INSENSITIVE_ORDER);
        Comparator<Candidate> byId = Comparator.comparing(candidate -> candidate.template().getId());
        return switch (sort) {
            case CODE -> Comparator.<Candidate, String>comparing(candidate -> Objects.toString(candidate.code(), ""),
                    String.CASE_INSENSITIVE_ORDER).thenComparing(byName).thenComparing(byId);
            case RECENT -> Comparator.comparing((Candidate candidate) -> candidate.version().getUpdatedAt(),
                    Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byName).thenComparing(byId);
            case NAME -> byName.thenComparing(byId);
        };
    }

    private AssignmentDtos.BriefNode briefNode(AssignmentTemplateReader.Node node, Long tenantId,
                                               Map<UUID, Optional<AssignmentDtos.BriefRubric>> rubricCache) {
        ObjectNode content = node.content();
        var capacity = reader.capacity(node);
        String description = text(content, "description", null);
        return new AssignmentDtos.BriefNode(node.templateId(), node.code(), node.name(),
                description == null ? text(content, "context", null) : description,
                text(content, "technologyStack", null), text(content, "level", null),
                integer(content, "estimatedDurationWeeks"), capacity.minMembers(), capacity.maxMembers(),
                reader.roles(node), milestones(content.path("milestones"), tenantId, rubricCache),
                backlog(content.path("backlogItems")),
                node.modules().stream().map(module -> briefNode(module, tenantId, rubricCache)).toList());
    }

    private List<AssignmentDtos.BriefMilestone> milestones(JsonNode values, Long tenantId,
                                                          Map<UUID, Optional<AssignmentDtos.BriefRubric>> rubricCache) {
        List<AssignmentDtos.BriefMilestone> result = new ArrayList<>();
        for (JsonNode value : values) {
            JsonNode checklist = value.has("checklistItems") ? value.path("checklistItems") : value.path("checklist");
            List<AssignmentDtos.BriefChecklistItem> items = new ArrayList<>();
            for (JsonNode item : checklist) {
                String content = text(item, "content", null);
                if (content != null) items.add(new AssignmentDtos.BriefChecklistItem(content, item.path("mandatory").asBoolean(false)));
            }
            result.add(new AssignmentDtos.BriefMilestone(text(value, "title", "Milestone " + (result.size() + 1)),
                    text(value, "description", null), integer(value, "dueAfter"), text(value, "dueUnit", null),
                    value.path("weight").isNumber() ? value.path("weight").decimalValue() : decimal(value.path("weight")),
                    value.path("mandatory").asBoolean(true), List.copyOf(items), rubric(value, tenantId, rubricCache)));
        }
        return List.copyOf(result);
    }

    /** The published rubric version referenced by the milestone, else the criteria embedded by older templates. */
    private AssignmentDtos.BriefRubric rubric(JsonNode milestone, Long tenantId,
                                              Map<UUID, Optional<AssignmentDtos.BriefRubric>> rubricCache) {
        UUID versionId = uuid(milestone.path("rubricVersionId"));
        if (versionId != null) {
            var resolved = rubricCache.computeIfAbsent(versionId,
                    id -> rubrics.findPublished(id, tenantId).map(AssignmentCatalogService::rubric));
            if (resolved.isPresent()) return resolved.get();
        }
        JsonNode legacy = milestone.has("rubricCriteria") ? milestone.path("rubricCriteria") : milestone.path("legacyRubricCriteria");
        List<AssignmentDtos.BriefRubricCriterion> criteria = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (JsonNode criterion : legacy) {
            String name = text(criterion, "name", null);
            if (name == null) continue;
            BigDecimal maxScore = criterion.path("maxScore").isNumber() ? criterion.path("maxScore").decimalValue()
                    : decimal(criterion.path("maxScore"));
            if (maxScore != null) total = total.add(maxScore);
            criteria.add(new AssignmentDtos.BriefRubricCriterion(null, name, text(criterion, "description", null),
                    null, maxScore, List.of()));
        }
        return criteria.isEmpty() ? null
                : new AssignmentDtos.BriefRubric(null, null, null, total, true, List.copyOf(criteria));
    }

    private static AssignmentDtos.BriefRubric rubric(RubricVersion version) {
        return new AssignmentDtos.BriefRubric(version.getNameSnapshot(), "v" + version.getVersionNumber(),
                version.getDescriptionSnapshot(), version.getTotalMaxScore(), false,
                version.getCriteria().stream().map(criterion -> new AssignmentDtos.BriefRubricCriterion(
                        criterion.getCode(), criterion.getName(), criterion.getDescription(), criterion.getWeight(),
                        criterion.getMaxScore(), criterion.getRatings().stream().map(rating ->
                                new AssignmentDtos.BriefRubricRating(rating.getLevel().name(), rating.getPercentage(),
                                        rating.getDescription())).toList())).toList());
    }

    private static UUID uuid(JsonNode value) {
        if (!value.isTextual()) return null;
        try { return UUID.fromString(value.asText().strip()); }
        catch (IllegalArgumentException exception) { return null; }
    }

    private static List<AssignmentDtos.BriefBacklogItem> backlog(JsonNode values) {
        List<AssignmentDtos.BriefBacklogItem> result = new ArrayList<>();
        for (JsonNode value : values) {
            String title = text(value, "title", null);
            if (title != null) result.add(new AssignmentDtos.BriefBacklogItem(title, text(value, "description", null),
                    text(value, "suggestedRole", null)));
        }
        return List.copyOf(result);
    }

    private static String text(JsonNode node, String field, String fallback) {
        JsonNode value = node.path(field);
        if (!value.isValueNode() || value.isNull()) return fallback;
        String text = value.asText().strip();
        return text.isEmpty() ? fallback : text;
    }

    private static Integer integer(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isIntegralNumber() && value.canConvertToInt() ? value.asInt() : null;
    }

    private static BigDecimal decimal(JsonNode value) {
        if (!value.isTextual()) return null;
        try { return new BigDecimal(value.asText().strip()); }
        catch (NumberFormatException exception) { return null; }
    }
}
