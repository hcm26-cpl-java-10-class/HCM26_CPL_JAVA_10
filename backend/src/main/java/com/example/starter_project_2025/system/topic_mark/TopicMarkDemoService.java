package com.example.starter_project_2025.system.topic_mark;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.student_score.StudentScore;
import com.example.starter_project_2025.system.demo.student_score.StudentScoreRepository;
import com.example.starter_project_2025.system.topic_mark.dto.ScoreHistoryResponse;
import com.example.starter_project_2025.system.topic_mark.dto.TopicMarkDetailResponse;
import com.example.starter_project_2025.system.topic_mark.dto.TopicMarkGradebookResponse;
import com.example.starter_project_2025.system.topic_mark.dto.TopicMarkGradebookSearchResponse;
import com.example.starter_project_2025.system.topic_mark.dto.TopicMarkPageResponse;
import com.example.starter_project_2025.system.topic_mark.dto.UpdateTopicMarkRequest;
import jakarta.transaction.Transactional;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TopicMarkDemoService {

    static final String FINAL_SCORE_KEY = "FINAL_SCORE";
    static final String IS_PASSED_KEY = "IS_PASSED";

    static final Pattern KEY_WITH_INDEX_PATTERN = Pattern.compile("^(.*?)(\\d+)$");

    StudentScoreRepository studentScoreRepository;

    List<ScoreHistoryResponse.HistoryItem> historyStore = new CopyOnWriteArrayList<>();

    public TopicMarkGradebookResponse getGradebook() {
        List<StudentScore> students = getAllStudents();
        List<ComponentDef> components = buildComponentDefs(students);

        return TopicMarkGradebookResponse.builder()
                .columns(buildColumns(components))
                .rows(buildRows(students, components))
                .build();
    }

    public TopicMarkGradebookSearchResponse searchGradebook(String keyword, int page, int size, String sort) {
        List<StudentScore> students = getAllStudents();
        List<ComponentDef> components = buildComponentDefs(students);

        List<TopicMarkGradebookResponse.Row> allRows = buildRows(students, components);

        List<TopicMarkGradebookResponse.Row> filtered = filterRows(allRows, keyword);
        filtered.sort(resolveRowComparator(sort));

        int safeSize = Math.max(size, 1);
        int safePage = Math.max(page, 0);

        int totalElements = filtered.size();
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / safeSize);
        int fromIndex = Math.min(safePage * safeSize, totalElements);
        int toIndex = Math.min(fromIndex + safeSize, totalElements);

        List<TopicMarkGradebookResponse.Row> pageContent = filtered.subList(fromIndex, toIndex);

        return TopicMarkGradebookSearchResponse.builder()
                .columns(buildColumns(components))
                .rows(TopicMarkPageResponse.<TopicMarkGradebookResponse.Row>builder()
                        .content(pageContent)
                        .page(safePage)
                        .size(safeSize)
                        .totalElements(totalElements)
                        .totalPages(totalPages)
                        .sort(sort)
                        .build())
                .build();
    }

    public TopicMarkDetailResponse getStudentDetail(UUID userId) {
        StudentScore student = findStudentByUserId(userId);
        List<ComponentDef> components = buildComponentDefs(getAllStudents());

        List<TopicMarkDetailResponse.ComponentSection> sections = components.stream()
                .map(component -> {
                    Double score = getScoreValue(student.getScores(), component.sourceKey());

                    return TopicMarkDetailResponse.ComponentSection.builder()
                            .componentId(component.componentId().toString())
                            .componentName(component.label())
                            .componentType(component.componentType())
                            .weight(component.weight())
                            .isGraded(component.isGraded())
                            .sectionScore(score)
                            .slots(List.of(
                                    TopicMarkDetailResponse.SlotScore.builder()
                                            .index(component.componentIndex())
                                            .score(score)
                                            .build()
                            ))
                            .build();
                })
                .toList();

        List<TopicMarkDetailResponse.HistoryEntry> historyEntries = historyStore.stream()
                .filter(item -> item.getStudent() != null && Objects.equals(item.getStudent().getId(), userId))
                .sorted(Comparator.comparing(ScoreHistoryResponse.HistoryItem::getUpdatedAt).reversed())
                .map(item -> TopicMarkDetailResponse.HistoryEntry.builder()
                        .componentLabel(item.getColumn() != null ? item.getColumn().getName() : "Unknown")
                        .oldScore(item.getOldScore())
                        .newScore(item.getNewScore())
                        .changeType(item.getChangeType())
                        .reason(item.getReason())
                        .updatedBy(item.getUpdatedBy() != null ? item.getUpdatedBy().getName() : "System")
                        .updatedAt(item.getUpdatedAt())
                        .build())
                .toList();

        Double finalScore = student.getOverallScore() == null ? null : student.getOverallScore().doubleValue();

        return TopicMarkDetailResponse.builder()
                .userId(userId)
                .fullName(student.getStudentName())
                .sections(sections)
                .finalScore(finalScore)
                .isPassed(finalScore != null && finalScore >= 5)
                .history(historyEntries)
                .build();
    }

    public TopicMarkDetailResponse updateStudentMarks(UUID userId, UpdateTopicMarkRequest request) {
        StudentScore student = findStudentByUserId(userId);

        if (student.isPublished()) {
            throw new BadRequestException("Score already released, use an adjustment with a reason instead");
        }

        Map<String, BigDecimal> scores = new LinkedHashMap<>(student.getScores() == null ? Map.of() : student.getScores());
        List<ComponentDef> components = buildComponentDefs(getAllStudents());

        Map<String, ComponentDef> componentLookup = components.stream()
                .collect(Collectors.toMap(ComponentDef::columnKey, component -> component));

        if (request.getEntries() != null) {
            for (UpdateTopicMarkRequest.EntryUpdate entry : request.getEntries()) {
                String key = entry.getComponentId() + "_" + entry.getComponentIndex();
                ComponentDef component = componentLookup.get(key);

                if (component == null) {
                    continue;
                }

                BigDecimal oldValue = scores.get(component.sourceKey());
                BigDecimal newValue = entry.getScore() == null
                        ? null
                        : BigDecimal.valueOf(entry.getScore()).setScale(2, RoundingMode.HALF_UP);

                if (newValue == null) {
                    scores.remove(component.sourceKey());
                } else {
                    scores.put(component.sourceKey(), newValue);
                }

                appendHistory(student, component, oldValue, newValue, request.getReason());
            }
        }

        student.setScores(scores);
        student.setOverallScore(calculateOverall(scores));

        studentScoreRepository.save(student);

        return getStudentDetail(userId);
    }

    public ScoreHistoryResponse getHistory(int page, int size, String sort) {
        List<ScoreHistoryResponse.HistoryItem> sorted = new ArrayList<>(historyStore);
        sorted.sort(resolveHistoryComparator(sort));

        int safeSize = Math.max(size, 1);
        int safePage = Math.max(page, 0);

        int totalElements = sorted.size();
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / safeSize);
        int fromIndex = Math.min(safePage * safeSize, totalElements);
        int toIndex = Math.min(fromIndex + safeSize, totalElements);

        return ScoreHistoryResponse.builder()
                .content(sorted.subList(fromIndex, toIndex))
                .page(safePage)
                .size(safeSize)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .sort(sort)
                .build();
    }

    private List<StudentScore> getAllStudents() {
        return studentScoreRepository.findAll();
    }

    private StudentScore findStudentByUserId(UUID userId) {
        return getAllStudents().stream()
                .filter(student -> Objects.equals(toUserId(student), userId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Student not found for userId: " + userId));
    }

    private List<TopicMarkGradebookResponse.Column> buildColumns(List<ComponentDef> components) {
        List<TopicMarkGradebookResponse.Column> columns = components.stream()
                .map(component -> TopicMarkGradebookResponse.Column.builder()
                        .key(component.columnKey())
                        .label(component.label())
                        .componentId(component.componentId().toString())
                        .componentIndex(component.componentIndex())
                        .componentType(component.componentType())
                        .weight(component.weight())
                        .isGraded(component.isGraded())
                        .build())
                .collect(Collectors.toCollection(ArrayList::new));

        columns.add(new TopicMarkGradebookResponse.Column(FINAL_SCORE_KEY, "Final Score"));
        columns.add(new TopicMarkGradebookResponse.Column(IS_PASSED_KEY, "Is Passed"));

        return columns;
    }

    private List<TopicMarkGradebookResponse.Row> buildRows(
            List<StudentScore> students,
            List<ComponentDef> components
    ) {
        return students.stream()
                .map(student -> {
                    Map<String, Object> values = new LinkedHashMap<>();

                    for (ComponentDef component : components) {
                        values.put(component.columnKey(), getScoreValue(student.getScores(), component.sourceKey()));
                    }

                    Double finalScore = student.getOverallScore() == null
                            ? null
                            : student.getOverallScore().doubleValue();

                    values.put(FINAL_SCORE_KEY, finalScore);
                    values.put(IS_PASSED_KEY, finalScore != null && finalScore >= 5);

                    return TopicMarkGradebookResponse.Row.builder()
                            .userId(toUserId(student))
                            .fullName(student.getStudentName())
                            .email(toEmail(student))
                            .values(values)
                            .build();
                })
                .toList();
    }

    private List<TopicMarkGradebookResponse.Row> filterRows(List<TopicMarkGradebookResponse.Row> rows, String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return new ArrayList<>(rows);
        }

        String lowered = keyword.toLowerCase(Locale.ROOT);

        return rows.stream()
                .filter(row ->
                        containsIgnoreCase(row.getFullName(), lowered) ||
                        containsIgnoreCase(row.getEmail(), lowered)
                )
                .collect(Collectors.toCollection(ArrayList::new));
    }

    private Comparator<TopicMarkGradebookResponse.Row> resolveRowComparator(String sort) {
        String safeSort = sort == null || sort.isBlank() ? "fullName,asc" : sort;
        String[] parts = safeSort.split(",");

        String field = parts[0].trim();
        boolean desc = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim());

        Comparator<TopicMarkGradebookResponse.Row> comparator = switch (field) {
            case "email" -> Comparator.comparing(row -> Optional.ofNullable(row.getEmail()).orElse(""));
            case "finalScore" -> Comparator.comparing(
                    row -> (Double) Optional.ofNullable(row.getValues()).map(values -> values.get(FINAL_SCORE_KEY)).orElse(null),
                    Comparator.nullsLast(Double::compareTo)
            );
            default -> Comparator.comparing(row -> Optional.ofNullable(row.getFullName()).orElse(""));
        };

        return desc ? comparator.reversed() : comparator;
    }

    private Comparator<ScoreHistoryResponse.HistoryItem> resolveHistoryComparator(String sort) {
        String safeSort = sort == null || sort.isBlank() ? "updatedAt,desc" : sort;
        boolean desc = safeSort.toLowerCase(Locale.ROOT).endsWith(",desc");

        Comparator<ScoreHistoryResponse.HistoryItem> comparator = Comparator.comparing(
                ScoreHistoryResponse.HistoryItem::getUpdatedAt,
                Comparator.nullsLast(LocalDateTime::compareTo)
        );

        return desc ? comparator.reversed() : comparator;
    }

    private List<ComponentDef> buildComponentDefs(List<StudentScore> students) {
        Set<String> sourceKeys = students.stream()
                .map(StudentScore::getScores)
                .filter(Objects::nonNull)
                .map(Map::keySet)
                .flatMap(Set::stream)
                .collect(Collectors.toCollection(java.util.TreeSet::new));

        if (sourceKeys.isEmpty()) {
            return List.of();
        }

        double defaultWeight = 100d / sourceKeys.size();

        return sourceKeys.stream()
                .map(sourceKey -> buildComponentDef(sourceKey, defaultWeight))
                .toList();
    }

    private ComponentDef buildComponentDef(String sourceKey, double defaultWeight) {
        Matcher matcher = KEY_WITH_INDEX_PATTERN.matcher(sourceKey);

        String componentName = sourceKey;
        int componentIndex = 1;

        if (matcher.matches()) {
            componentName = matcher.group(1);
            componentIndex = Integer.parseInt(matcher.group(2));
        }

        String normalizedName = componentName.isBlank() ? sourceKey : componentName;
        String label = toDisplayLabel(normalizedName, componentIndex, matcher.matches());
        UUID componentId = UUID.nameUUIDFromBytes(("topic-component:" + normalizedName).getBytes(StandardCharsets.UTF_8));
        String columnKey = componentId + "_" + componentIndex;

        return new ComponentDef(
                sourceKey,
                columnKey,
                componentId,
                componentIndex,
                normalizedName.toUpperCase(Locale.ROOT),
                label,
                round(defaultWeight),
                true
        );
    }

    private void appendHistory(
            StudentScore student,
            ComponentDef component,
            BigDecimal oldValue,
            BigDecimal newValue,
            String reason
    ) {
        Double oldScore = oldValue == null ? null : oldValue.doubleValue();
        Double newScore = newValue == null ? null : newValue.doubleValue();

        String changeType;
        if (oldScore == null && newScore != null) {
            changeType = "INCREASE";
        } else if (oldScore != null && newScore == null) {
            changeType = "DECREASE";
        } else if (oldScore != null && newScore != null && newScore < oldScore) {
            changeType = "DECREASE";
        } else {
            changeType = "INCREASE";
        }

        historyStore.add(ScoreHistoryResponse.HistoryItem.builder()
                .id(UUID.randomUUID())
                .trainingClassId(UUID.nameUUIDFromBytes(("class:" + student.getClassName()).getBytes(StandardCharsets.UTF_8)))
                .student(ScoreHistoryResponse.UserRef.builder()
                        .id(toUserId(student))
                        .name(student.getStudentName())
                        .build())
                .column(ScoreHistoryResponse.ColumnRef.builder()
                        .id(component.columnKey())
                        .name(component.label())
                        .build())
                .oldScore(oldScore)
                .newScore(newScore)
                .changeType(changeType)
                .reason(reason)
                .updatedBy(ScoreHistoryResponse.UserRef.builder()
                        .id(UUID.nameUUIDFromBytes("demo-trainer".getBytes(StandardCharsets.UTF_8)))
                        .name("Demo Trainer")
                        .build())
                .updatedAt(LocalDateTime.now())
                .build());
    }

    private BigDecimal calculateOverall(Map<String, BigDecimal> scores) {
        if (scores == null || scores.isEmpty()) {
            return null;
        }

        BigDecimal total = scores.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return total.divide(BigDecimal.valueOf(scores.size()), 2, RoundingMode.HALF_UP);
    }

    private Double getScoreValue(Map<String, BigDecimal> scores, String key) {
        if (scores == null || !scores.containsKey(key) || scores.get(key) == null) {
            return null;
        }

        return scores.get(key).doubleValue();
    }

    private UUID toUserId(StudentScore student) {
        return UUID.nameUUIDFromBytes(("student:" + student.getStudentCode()).getBytes(StandardCharsets.UTF_8));
    }

    private String toEmail(StudentScore student) {
        return student.getStudentCode().toLowerCase(Locale.ROOT) + "@example.com";
    }

    private String toDisplayLabel(String componentName, int index, boolean hasIndexInKey) {
        String prettyName = componentName
                .replace("_", " ")
                .replace("-", " ")
                .trim();

        if (!prettyName.isBlank()) {
            prettyName = prettyName.substring(0, 1).toUpperCase(Locale.ROOT) + prettyName.substring(1);
        }

        return hasIndexInKey ? prettyName + " " + index : prettyName;
    }

    private Double round(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private boolean containsIgnoreCase(String source, String keywordLower) {
        return source != null && source.toLowerCase(Locale.ROOT).contains(keywordLower);
    }

    private record ComponentDef(
            String sourceKey,
            String columnKey,
            UUID componentId,
            Integer componentIndex,
            String componentType,
            String label,
            Double weight,
            Boolean isGraded
    ) {
    }
}
