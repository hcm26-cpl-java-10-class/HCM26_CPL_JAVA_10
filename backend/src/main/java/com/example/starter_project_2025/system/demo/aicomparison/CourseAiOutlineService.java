package com.example.starter_project_2025.system.demo.aicomparison;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.aicourse.AiTextClient;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiOutlineRequest;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiOutlineResponse;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * So sánh CẤU TRÚC NỘI DUNG (outline) của 1 khóa học mục tiêu với các khóa học khác.
 *
 * <p>Khác với {@link CourseAiComparisonService} (chỉ dựa trên số liệu học tập),
 * service này đưa vào prompt danh sách section/lesson: tiêu đề, loại nội dung và
 * thời lượng.
 *
 * <p><b>Không</b> gửi {@code textContent} / {@code contentUrl}: nặng token, và bị khóa
 * với người chưa ghi danh.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class CourseAiOutlineService {

    private final CourseRepository courseRepository;
    private final SectionRepository sectionRepository;
    private final LessonRepository lessonRepository;
    private final AiTextClient aiClient;
    private final ObjectMapper objectMapper;

    /** Số khóa học tối đa gửi cho AI. */
    static final int MAX_PEERS = 8;

    public AiOutlineResponse compareOutlines(AiOutlineRequest request) {
        Course target = courseRepository.findById(request.targetCourseId())
                .orElseThrow(() -> new BadRequestException("The target course does not exist."));

        List<Course> peers = selectPeers(target, request.peerCourseIds());

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("target", outline(target));
        ArrayNode peersNode = payload.putArray("peers");
        for (Course peer : peers) {
            peersNode.add(outline(peer));
        }

        String system = CourseAiPrompts.fill(CourseAiPrompts.OUTLINE_SYSTEM, Map.of(
                "LANGUAGE_RULE", CourseAiPrompts.languageRule(request.language())));
        String user = CourseAiPrompts.fill(CourseAiPrompts.OUTLINE_USER, Map.of(
                "OUTLINE_JSON", json(payload),
                "USER_FOCUS", CourseAiComparisonService.sanitize(request.focus())));

        JsonNode raw = aiClient.generateJson(system, List.of(new AiTextClient.Turn("user", user)),
                CourseAiPrompts.ANALYSIS_TEMPERATURE);

        return new AiOutlineResponse(
                target.getId(),
                target.getName(),
                peers.stream().map(Course::getId).toList(),
                sanitize(raw, peers));
    }

    // =====================================================================
    // Chọn peers
    // =====================================================================

    private List<Course> selectPeers(Course target, List<Long> requestedIds) {
        if (requestedIds != null && !requestedIds.isEmpty()) {
            List<Course> peers = new ArrayList<>();
            Set<Long> seen = new LinkedHashSet<>();
            for (Long id : requestedIds) {
                if (id == null || id.equals(target.getId()) || !seen.add(id)) {
                    continue;
                }
                courseRepository.findById(id).ifPresent(peers::add);
            }
            return peers.size() > MAX_PEERS ? peers.subList(0, MAX_PEERS) : peers;
        }
        // Tự động: cùng level trước, sau đó theo số bài học giảm dần.
        List<Course> candidates = courseRepository.findAll().stream()
                .filter(course -> !course.getId().equals(target.getId()))
                .filter(course -> Boolean.TRUE.equals(course.getIsActive()))
                .sorted((a, b) -> {
                    boolean sameLevel = a.getLevel() != null && a.getLevel() == b.getLevel();
                    if (sameLevel != (b.getLevel() != null && b.getLevel() == a.getLevel())) {
                        return sameLevel ? -1 : 1;
                    }
                    return Integer.compare(lessonCount(b), lessonCount(a));
                })
                .toList();
        return candidates.size() > MAX_PEERS ? candidates.subList(0, MAX_PEERS) : candidates;
    }

    // =====================================================================
    // Dựng outline
    // =====================================================================

    private ObjectNode outline(Course course) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("courseId", course.getId());
        node.put("name", course.getName());
        node.put("level", course.getLevel() == null ? null : course.getLevel().name());
        ArrayNode categories = node.putArray("categoryNames");
        if (course.getCategories() != null) {
            course.getCategories().stream()
                    .map(category -> category.getName())
                    .filter(name -> name != null && !name.isBlank())
                    .forEach(categories::add);
        }

        List<Section> sections = sectionRepository.findByCourse_IdOrderByOrderIndexAsc(course.getId()).stream()
                .filter(section -> Boolean.TRUE.equals(section.getIsActive()))
                .toList();

        Map<Long, List<Lesson>> lessonsBySection = new LinkedHashMap<>();
        int lessonCount = 0;
        long totalDuration = 0;
        for (Lesson lesson : lessonRepository.findActiveByCourseIdOrdered(course.getId())) {
            lessonsBySection.computeIfAbsent(lesson.getSection().getId(), key -> new ArrayList<>()).add(lesson);
            lessonCount++;
            totalDuration += lesson.getDuration() == null ? 0 : lesson.getDuration();
        }
        node.put("lessonCount", lessonCount);
        node.put("totalDuration", totalDuration);

        ArrayNode sectionsNode = node.putArray("sections");
        for (Section section : sections) {
            ObjectNode sectionNode = sectionsNode.addObject();
            sectionNode.put("title", section.getTitle());
            ArrayNode lessonsNode = sectionNode.putArray("lessons");
            for (Lesson lesson : lessonsBySection.getOrDefault(section.getId(), List.of())) {
                ObjectNode lessonNode = lessonsNode.addObject();
                lessonNode.put("title", lesson.getTitle());
                lessonNode.put("contentType", lesson.getContentType() == null ? null : lesson.getContentType().name());
                lessonNode.put("duration", lesson.getDuration() == null ? 0 : lesson.getDuration());
            }
        }

        // Khoá học dựng từ syllabus: thêm mã/tên syllabus để AI hiểu ngữ cảnh.
        if (course.getSyllabus() != null) {
            ObjectNode syllabus = node.putObject("syllabus");
            syllabus.put("code", course.getSyllabus().getCode());
            syllabus.put("name", course.getSyllabus().getName());
        }
        return node;
    }

    private int lessonCount(Course course) {
        return sectionRepository.findByCourse_IdOrderByOrderIndexAsc(course.getId()).stream()
                .filter(section -> Boolean.TRUE.equals(section.getIsActive()))
                .mapToInt(section -> lessonRepository.findBySection_IdOrderByOrderIndexAsc(section.getId()).size())
                .sum();
    }

    // =====================================================================
    // Kiểm tra kết quả AI
    // =====================================================================

    private JsonNode sanitize(JsonNode raw, List<Course> peers) {
        if (raw == null || !raw.isObject()) {
            throw new BadRequestException("The AI returned an unreadable analysis. Please try again.");
        }
        Set<Long> peerIds = new LinkedHashSet<>();
        for (Course peer : peers) {
            peerIds.add(peer.getId());
        }

        ObjectNode out = objectMapper.createObjectNode();
        out.put("summary", raw.path("summary").asText(""));

        ObjectNode size = out.putObject("size");
        copySize(size.putObject("target"), raw.path("size").path("target"));
        copySize(size.putObject("peerMedian"), raw.path("size").path("peerMedian"));

        ArrayNode missingTopics = out.putArray("missingTopics");
        for (JsonNode topic : raw.path("missingTopics")) {
            ObjectNode node = missingTopics.addObject();
            node.put("topic", topic.path("topic").asText(""));
            ArrayNode covered = node.putArray("coveredByCourseIds");
            for (JsonNode id : topic.path("coveredByCourseIds")) {
                long value = id.asLong(-1);
                if (peerIds.contains(value)) {
                    covered.add(value);
                }
            }
            node.put("importance", normalizeImportance(topic.path("importance").asText("")));
            node.put("suggestedLesson", topic.path("suggestedLesson").asText(""));
            node.put("suggestedSection", topic.path("suggestedSection").asText(""));
        }

        out.set("uniqueStrengths", stringArray(raw.path("uniqueStrengths")));

        ObjectNode contentMix = out.putObject("contentMix");
        JsonNode rawMix = raw.path("contentMix").path("target");
        ObjectNode mixTarget = contentMix.putObject("target");
        if (rawMix.isObject()) {
            rawMix.fields().forEachRemaining(entry ->
                    mixTarget.put(entry.getKey(), entry.getValue().asInt(0)));
        }
        contentMix.put("peers", raw.path("contentMix").path("peers").asText(""));

        out.set("structureIssues", stringArray(raw.path("structureIssues")));
        out.set("uncertain", stringArray(raw.path("uncertain")));

        ArrayNode notComparable = out.putArray("notComparable");
        for (JsonNode item : raw.path("notComparable")) {
            long courseId = item.path("courseId").asLong(-1);
            if (!peerIds.contains(courseId)) {
                continue;
            }
            ObjectNode node = notComparable.addObject();
            node.put("courseId", courseId);
            node.put("reason", item.path("reason").asText(""));
        }
        return out;
    }

    private void copySize(ObjectNode target, JsonNode source) {
        target.put("sections", source.path("sections").asInt(0));
        target.put("lessons", source.path("lessons").asInt(0));
        target.put("hours", source.path("hours").asDouble(0));
    }

    private String normalizeImportance(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase();
        return switch (value) {
            case "HIGH", "MEDIUM", "LOW" -> value;
            default -> "MEDIUM";
        };
    }

    private ArrayNode stringArray(JsonNode node) {
        ArrayNode array = objectMapper.createArrayNode();
        if (node != null && node.isArray()) {
            for (JsonNode item : node) {
                String text = item.asText("").trim();
                if (!text.isEmpty()) {
                    array.add(text);
                }
            }
        }
        return array;
    }

    private String json(Object node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            log.warn("Could not serialize the outline payload", e);
            return "{}";
        }
    }
}
