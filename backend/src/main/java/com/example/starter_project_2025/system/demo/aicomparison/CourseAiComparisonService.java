package com.example.starter_project_2025.system.demo.aicomparison;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.aicourse.AiTextClient;
import com.example.starter_project_2025.system.demo.analytics.CourseComparisonDTO.CourseComparisonItem;
import com.example.starter_project_2025.system.demo.analytics.CourseComparisonDTO.CourseComparisonResponse;
import com.example.starter_project_2025.system.demo.analytics.CourseComparisonService;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiCompareRequest;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiCompareResponse;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiFollowUpRequest;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiFollowUpResponse;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiOutlineRequest;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiOutlineResponse;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiSummaryRequest;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiSummaryResponse;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonDTO.AiTurn;
import com.example.starter_project_2025.system.demo.aicomparison.CourseAiComparisonMetrics.Metric;
import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Phân tích so sánh khóa học bằng AI.
 *
 * <p><b>Nguyên tắc thiết kế:</b> backend tính toàn bộ số liệu (min/median/mean/max,
 * rank, percentile, gap, vị trí module), AI chỉ diễn giải bằng chữ và phải dẫn chứng.
 * Nhờ vậy AI không có cơ hội tự tính sai số liệu.
 *
 * <p>Ngoài ra:
 * <ul>
 *   <li>Chỉ gửi 1 target + tối đa 15 peers để tiết kiệm token.</li>
 *   <li>Chỉ số "thấp hơn là tốt" được đảo chiều khi tính rank/percentile.</li>
 *   <li>Tên khóa học, giảng viên, mô tả do người dùng nhập là DATA, không phải lệnh.</li>
 *   <li>Sau khi AI trả về JSON, backend kiểm tra lại (moduleKey hợp lệ, courseId có thật).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CourseAiComparisonService {

    /** Số khóa học tối đa được gửi cho AI (token + độ nhiễu). */
    static final int MAX_PEERS = 15;

    /** Độ dài tối đa của focus do người dùng nhập. */
    static final int MAX_FOCUS_LENGTH = 400;

    /** Ngưỡng chênh lệch số học viên để coi là "không cùng đối tượng". */
    private static final double LEARNER_RATIO_LIMIT = 5.0;

    private final CourseComparisonService comparisonService;
    private final CourseRepository courseRepository;
    private final AiTextClient aiClient;
    private final ObjectMapper objectMapper;

    // =====================================================================
    // Prompt 1 — Phân tích so sánh
    // =====================================================================

    public AiCompareResponse compareWithPeers(AiCompareRequest request) {
        CourseComparisonResponse all = comparisonService.compareCourses(
                request.from(), request.to(), null, null);

        CourseComparisonItem target = findItem(all, request.targetCourseId());

        boolean autoSelected = request.peerCourseIds() == null || request.peerCourseIds().isEmpty();
        PeerSelection selection = selectPeersWithMeta(all, target, request.peerCourseIds());
        List<CourseComparisonItem> peers = selection.peers();

        ObjectNode payload = buildPayload(all, target, peers);

        String system = CourseAiPrompts.fill(CourseAiPrompts.COMPARE_SYSTEM, Map.of(
                "LANGUAGE_RULE", CourseAiPrompts.languageRule(request.language())));
        String user = CourseAiPrompts.fill(CourseAiPrompts.COMPARE_USER, Map.of(
                "COMPARISON_JSON", json(payload),
                "USER_FOCUS", sanitize(request.focus())));

        JsonNode raw = aiClient.generateJson(system, List.of(new AiTextClient.Turn("user", user)),
                CourseAiPrompts.ANALYSIS_TEMPERATURE);
        JsonNode analysis = sanitizeAnalysis(raw, peers);

        return new AiCompareResponse(
                target.courseId(),
                target.courseName(),
                peers.stream().map(CourseComparisonItem::courseId).toList(),
                peers.size(),
                selection.truncated(),
                autoSelected,
                analysis);
    }

    // =====================================================================
    // Prompt 2 — Hỏi đáp tiếp
    // =====================================================================

    public AiFollowUpResponse answerFollowUp(AiFollowUpRequest request) {
        if (request.question() == null || request.question().isBlank()) {
            throw new BadRequestException("The question cannot be empty.");
        }
        CourseComparisonResponse all = comparisonService.compareCourses(
                request.from(), request.to(), null, null);
        CourseComparisonItem target = findItem(all, request.targetCourseId());
        PeerSelection selection = selectPeersWithMeta(all, target, request.peerCourseIds());
        List<CourseComparisonItem> peers = selection.peers();
        ObjectNode payload = buildPayload(all, target, peers);

        String system = CourseAiPrompts.fill(CourseAiPrompts.FOLLOW_UP_SYSTEM, Map.of(
                "LANGUAGE_RULE", CourseAiPrompts.languageRule(request.language())));
        String user = CourseAiPrompts.fill(CourseAiPrompts.FOLLOW_UP_USER, Map.of(
                "COMPARISON_JSON", json(payload),
                "QUESTION", sanitize(request.question())));

        List<AiTextClient.Turn> turns = new ArrayList<>();
        if (request.history() != null) {
            for (AiTurn turn : request.history()) {
                if (turn == null || turn.content() == null || turn.content().isBlank()) {
                    continue;
                }
                turns.add(new AiTextClient.Turn(
                        "assistant".equalsIgnoreCase(turn.role()) ? "assistant" : "user",
                        truncate(turn.content(), 2000)));
            }
        }
        turns.add(new AiTextClient.Turn("user", user));

        JsonNode raw = aiClient.generateJson(system, turns, CourseAiPrompts.ANALYSIS_TEMPERATURE);
        JsonNode answer = sanitizeFollowUp(raw, target, peers);
        return new AiFollowUpResponse(answer);
    }

    // =====================================================================
    // Prompt 4 — Tóm tắt ngắn
    // =====================================================================

    public AiSummaryResponse summarize(AiSummaryRequest request) {
        if (request.analysis() == null || request.analysis().isNull()) {
            throw new BadRequestException("The analysis is empty.");
        }
        String system = CourseAiPrompts.fill(CourseAiPrompts.SUMMARY_SYSTEM, Map.of(
                "LANGUAGE_RULE", CourseAiPrompts.languageRule(request.language())));
        String user = CourseAiPrompts.fill(CourseAiPrompts.SUMMARY_USER, Map.of(
                "ANALYSIS_JSON", json(request.analysis())));

        JsonNode raw = aiClient.generateJson(system, List.of(new AiTextClient.Turn("user", user)),
                CourseAiPrompts.ANALYSIS_TEMPERATURE);
        ObjectNode result = objectMapper.createObjectNode();
        result.put("summary", raw.path("summary").asText("").trim());
        return new AiSummaryResponse(result);
    }

    // =====================================================================
    // Chọn target / peers
    // =====================================================================

    private CourseComparisonItem findItem(CourseComparisonResponse all, Long courseId) {
        if (courseId == null) {
            throw new BadRequestException("A target course is required.");
        }
        return all.courses().stream()
                .filter(item -> courseId.equals(item.courseId()))
                .findFirst()
                .orElseThrow(() -> new BadRequestException(
                        "The target course is not available in your course comparison data."));
    }

    /**
     * Chọn các khóa học đối chiếu.
     *
     * <p>Nếu người dùng chỉ định: lấy đúng các khóa đó (theo thứ tự yêu cầu),
     * loại bỏ target, tối đa {@link #MAX_PEERS}.
     *
     * <p>Nếu không chỉ định: chọn tự động — ưu tiên khóa học cùng category/level,
     * xếp theo điểm tổng hợp giảm dần, tối đa {@link #MAX_PEERS}.
     */
    /** Kết quả chọn peer: danh sách + cờ cho biết có bị cắt bớt hay không. */
    private record PeerSelection(List<CourseComparisonItem> peers, boolean truncated) {
    }

    private PeerSelection selectPeersWithMeta(CourseComparisonResponse all,
                                              CourseComparisonItem target,
                                              List<Long> requestedIds) {
        if (requestedIds != null && !requestedIds.isEmpty()) {
            Map<Long, CourseComparisonItem> byId = new LinkedHashMap<>();
            for (CourseComparisonItem item : all.courses()) {
                byId.put(item.courseId(), item);
            }
            List<CourseComparisonItem> peers = new ArrayList<>();
            Set<Long> seen = new LinkedHashSet<>();
            for (Long id : requestedIds) {
                if (id == null || id.equals(target.courseId()) || !seen.add(id)) {
                    continue;
                }
                CourseComparisonItem item = byId.get(id);
                if (item != null) {
                    peers.add(item);
                }
            }
            boolean truncated = peers.size() > MAX_PEERS;
            return new PeerSelection(
                    truncated ? List.copyOf(peers.subList(0, MAX_PEERS)) : List.copyOf(peers),
                    truncated);
        }

        // Tự động: khóa học cùng category/level trước, sau đó theo điểm tổng hợp.
        Set<Long> targetCategories = targetCategoryIds(target.courseId());
        Object targetLevel = targetLevel(target.courseId());

        List<CourseComparisonItem> candidates = all.courses().stream()
                .filter(item -> !item.courseId().equals(target.courseId()))
                .sorted(Comparator
                        .comparingInt((CourseComparisonItem item) ->
                                sameGroup(targetCategories, targetLevel, item.courseId()) ? 0 : 1)
                        .thenComparing(Comparator.comparingDouble(
                                (CourseComparisonItem item) -> item.overallScore()).reversed()))
                .toList();
        boolean truncated = candidates.size() > MAX_PEERS;
        return new PeerSelection(
                truncated ? List.copyOf(candidates.subList(0, MAX_PEERS)) : List.copyOf(candidates),
                truncated);
    }

    /**
     * Cùng "nhóm" = có chung category HOẶC cùng level.
     *
     * <p>DTO so sánh hiện tại không mang category/level, nên tra thêm từ bảng
     * {@code courses}. Nếu không tìm thấy (khóa đã xoá mềm) thì coi như khác nhóm.
     */
    private boolean sameGroup(Set<Long> targetCategories, Object targetLevel, Long otherCourseId) {
        Course other = courseRepository.findById(otherCourseId).orElse(null);
        if (other == null) {
            return false;
        }
        if (targetLevel != null && other.getLevel() == targetLevel) {
            return true;
        }
        if (targetCategories.isEmpty()) {
            return false;
        }
        return categoryIds(other).stream().anyMatch(targetCategories::contains);
    }

    private Set<Long> targetCategoryIds(Long courseId) {
        return courseRepository.findById(courseId)
                .map(this::categoryIds)
                .orElse(Set.of());
    }

    private Object targetLevel(Long courseId) {
        return courseRepository.findById(courseId)
                .map(Course::getLevel)
                .orElse(null);
    }

    private Set<Long> categoryIds(Course course) {
        if (course.getCategories() == null) {
            return Set.of();
        }
        return course.getCategories().stream()
                .map(Category::getId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
    }

    // =====================================================================
    // Payload + peerStats (toàn bộ số liệu do backend tính)
    // =====================================================================

    private ObjectNode buildPayload(CourseComparisonResponse all,
                                    CourseComparisonItem target,
                                    List<CourseComparisonItem> peers) {
        ObjectNode root = objectMapper.createObjectNode();

        ObjectNode period = root.putObject("period");
        period.put("from", all.from() == null ? null : all.from().toString());
        period.put("to", all.to() == null ? null : all.to().toString());
        period.put("granularity", all.granularity() == null ? null : all.granularity().name());
        root.put("inactiveThresholdDays", all.inactiveThresholdDays());

        root.set("target", objectMapper.valueToTree(CourseAiComparisonMetrics.payload(target)));
        ArrayNode peersNode = root.putArray("peers");
        for (CourseComparisonItem peer : peers) {
            peersNode.add(objectMapper.valueToTree(CourseAiComparisonMetrics.payload(peer)));
        }

        root.set("peerStats", buildPeerStats(target, peers));
        root.set("moduleStats", buildModuleStats(target, peers));
        root.set("gaps", buildGaps(target, peers));
        root.set("overallComputed", buildOverallComputed(target, peers));

        ArrayNode moduleKeys = root.putArray("moduleKeys");
        CourseAiComparisonMetrics.MODULE_KEYS.forEach(moduleKeys::add);

        return root;
    }

    /**
     * Thống kê trên tập PEERS + vị trí của target, cho từng chỉ số.
     *
     * <p>Rank tính trên tổng n+1 khóa (target + peers), theo chiều đã đảo:
     * chỉ số "thấp hơn là tốt" thì giá trị nhỏ hơn được rank cao hơn.
     */
    private ObjectNode buildPeerStats(CourseComparisonItem target, List<CourseComparisonItem> peers) {
        ObjectNode stats = objectMapper.createObjectNode();
        for (Metric metric : CourseAiComparisonMetrics.METRICS) {
            List<Double> peerValues = new ArrayList<>();
            for (CourseComparisonItem peer : peers) {
                Double value = CourseAiComparisonMetrics.value(peer, metric.key());
                if (value != null) {
                    peerValues.add(value);
                }
            }
            ObjectNode node = stats.putObject(metric.key());
            int n = peerValues.size();
            node.put("n", n);
            if (n == 0) {
                node.putNull("min");
                node.putNull("median");
                node.putNull("mean");
                node.putNull("max");
                node.putNull("bestCourseId");
                node.putNull("bestCourseName");
                node.putNull("targetRank");
                node.putNull("targetPercentile");
                continue;
            }

            List<Double> sorted = new ArrayList<>(peerValues);
            Collections.sort(sorted);
            node.put("min", sorted.get(0));
            node.put("median", CourseAiComparisonStats.median(sorted));
            node.put("mean", CourseAiComparisonStats.mean(peerValues));
            node.put("max", sorted.get(n - 1));

            CourseComparisonItem bestPeer = null;
            for (CourseComparisonItem peer : peers) {
                Double value = CourseAiComparisonMetrics.value(peer, metric.key());
                if (value == null) continue;
                if (bestPeer == null || better(value, bestValue(bestPeer, metric), metric.higherIsBetter())) {
                    bestPeer = peer;
                }
            }
            if (bestPeer != null) {
                node.put("bestCourseId", bestPeer.courseId());
                node.put("bestCourseName", bestPeer.courseName());
            } else {
                node.putNull("bestCourseId");
                node.putNull("bestCourseName");
            }

            // Rank của target trong tổng n+1 khóa (1 = tốt nhất).
            Double targetValue = CourseAiComparisonMetrics.value(target, metric.key());
            if (targetValue == null) {
                node.putNull("targetRank");
                node.putNull("targetPercentile");
            } else {
                node.put("targetRank",
                        CourseAiComparisonStats.rank(peerValues, targetValue, metric.higherIsBetter()));
                node.put("targetPercentile",
                        CourseAiComparisonStats.percentile(peerValues, targetValue, metric.higherIsBetter()));
            }
        }
        return stats;
    }

    private Double bestValue(CourseComparisonItem item, Metric metric) {
        return CourseAiComparisonMetrics.value(item, metric.key());
    }

    /** {@code true} nếu {@code a} tốt hơn {@code b} theo chiều của chỉ số. */
    private boolean better(Double a, Double b, boolean higherIsBetter) {
        if (a == null) return false;
        if (b == null) return true;
        return higherIsBetter ? a > b : a < b;
    }

    /**
     * Vị trí của target trong từng module — backend quyết định để AI không tự tính.
     *
     * <p>Quy tắc: dựa trên percentile của các chỉ số chính của module:
     * trên 67 = ABOVE, dưới 33 = BELOW, còn lại = AT_PAR.
     */
    private ObjectNode buildModuleStats(CourseComparisonItem target, List<CourseComparisonItem> peers) {
        ObjectNode node = objectMapper.createObjectNode();
        for (String moduleKey : CourseAiComparisonMetrics.MODULE_KEYS) {
            List<String> mainMetrics = CourseAiComparisonMetrics.MODULE_MAIN_METRICS.getOrDefault(moduleKey, List.of());
            List<Integer> percentiles = new ArrayList<>();
            for (String key : mainMetrics) {
                Integer percentile = percentileOf(target, peers, key);
                if (percentile != null) {
                    percentiles.add(percentile);
                }
            }
            ObjectNode module = node.putObject(moduleKey);
            module.put("position", CourseAiComparisonStats.position(percentiles));
            module.put("percentile", percentiles.isEmpty()
                    ? null
                    : (int) Math.round(percentiles.stream().mapToInt(Integer::intValue).average().orElse(50)));
            module.put("metricCount", percentiles.size());
        }
        return node;
    }

    private Integer percentileOf(CourseComparisonItem target, List<CourseComparisonItem> peers, String key) {
        Metric metric = CourseAiComparisonMetrics.metric(key);
        if (metric == null) return null;
        Double targetValue = CourseAiComparisonMetrics.value(target, key);
        if (targetValue == null) return null;
        List<Double> peerValues = new ArrayList<>();
        for (CourseComparisonItem peer : peers) {
            Double value = CourseAiComparisonMetrics.value(peer, key);
            if (value != null) {
                peerValues.add(value);
            }
        }
        if (peerValues.isEmpty()) return null;
        return CourseAiComparisonStats.percentile(peerValues, targetValue, metric.higherIsBetter());
    }

    /**
     * Các khoảng cách âm lớn nhất của target so với median của peers.
     * AI chỉ copy lại, không tự tính.
     */
    private ArrayNode buildGaps(CourseComparisonItem target, List<CourseComparisonItem> peers) {
        List<Map.Entry<String, Double>> gaps = new ArrayList<>();
        for (Metric metric : CourseAiComparisonMetrics.METRICS) {
            Double targetValue = CourseAiComparisonMetrics.value(target, metric.key());
            if (targetValue == null) continue;
            List<Double> peerValues = new ArrayList<>();
            for (CourseComparisonItem peer : peers) {
                Double value = CourseAiComparisonMetrics.value(peer, metric.key());
                if (value != null) {
                    peerValues.add(value);
                }
            }
            if (peerValues.size() < 3) {
                continue;   // quá ít peer: không đủ tin cậy để nêu gap
            }
            Collections.sort(peerValues);
            double median = CourseAiComparisonStats.median(peerValues);
            // Gap dương = target thua peers (kém hơn).
            double gap = metric.higherIsBetter() ? median - targetValue : targetValue - median;
            if (gap > 0) {
                gaps.add(Map.entry(metric.key(), CourseAiComparisonStats.round2(gap)));
            }
        }
        gaps.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));

        ArrayNode array = objectMapper.createArrayNode();
        int limit = Math.min(gaps.size(), 8);
        for (int i = 0; i < limit; i++) {
            String key = gaps.get(i).getKey();
            Metric metric = CourseAiComparisonMetrics.metric(key);
            Double targetValue = CourseAiComparisonMetrics.value(target, key);
            List<Double> peerValues = new ArrayList<>();
            for (CourseComparisonItem peer : peers) {
                Double value = CourseAiComparisonMetrics.value(peer, key);
                if (value != null) {
                    peerValues.add(value);
                }
            }
            ObjectNode gap = array.addObject();
            gap.put("moduleKey", metric == null ? "ranking" : metric.moduleKey());
            gap.put("metric", key);
            gap.put("target", targetValue);
            gap.put("peerMedian", CourseAiComparisonStats.medianOf(peerValues));
            gap.put("gap", gaps.get(i).getValue());
        }
        return array;
    }

    /** Verdict + rank tổng thể, do backend tính sẵn. */
    private ObjectNode buildOverallComputed(CourseComparisonItem target, List<CourseComparisonItem> peers) {
        ObjectNode node = objectMapper.createObjectNode();
        List<CourseComparisonItem> all = new ArrayList<>(peers);
        all.add(target);
        all.sort(Comparator.comparingDouble((CourseComparisonItem item) -> item.overallScore()).reversed());
        int rank = 1;
        for (int i = 0; i < all.size(); i++) {
            if (all.get(i).courseId().equals(target.courseId())) {
                rank = i + 1;
                break;
            }
        }
        node.put("verdict", overallVerdict(rank, all.size()));
        node.put("rank", rank);
        node.put("outOf", all.size());
        node.put("overallScore", target.overallScore());
        return node;
    }

    private String overallVerdict(int rank, int total) {
        if (total <= 1) return "SIMILAR";
        double percentile = (double) (total - rank) / (double) total * 100.0;
        if (percentile >= 67) return "STRONGER";
        if (percentile <= 33) return "WEAKER";
        return "SIMILAR";
    }

    // =====================================================================
    // Kiểm tra & chuẩn hoá kết quả AI
    // =====================================================================

    /**
     * Lưới an toàn: loại bỏ moduleKey không hợp lệ, courseId bịa, số liệu vô lý.
     */
    private JsonNode sanitizeAnalysis(JsonNode raw, List<CourseComparisonItem> peers) {
        if (raw == null || !raw.isObject()) {
            throw new BadRequestException("The AI returned an unreadable analysis. Please try again.");
        }
        Set<Long> peerIds = new LinkedHashSet<>();
        for (CourseComparisonItem peer : peers) {
            peerIds.add(peer.courseId());
        }

        ObjectNode out = objectMapper.createObjectNode();
        out.put("headline", raw.path("headline").asText(""));

        ObjectNode overall = out.putObject("overall");
        JsonNode rawOverall = raw.path("overall");
        overall.put("verdict", normalizeVerdict(rawOverall.path("verdict").asText("")));
        overall.put("rank", rawOverall.path("rank").asInt(0));
        overall.put("outOf", rawOverall.path("outOf").asInt(0));
        overall.put("summary", rawOverall.path("summary").asText(""));

        // --- modules: chỉ giữ 8 key đúng thứ tự ---
        ArrayNode modules = out.putArray("modules");
        Map<String, JsonNode> rawByKey = new LinkedHashMap<>();
        for (JsonNode node : raw.path("modules")) {
            String key = node.path("moduleKey").asText("");
            if (CourseAiComparisonMetrics.MODULE_KEYS.contains(key)) {
                rawByKey.putIfAbsent(key, node);
            }
        }
        for (String moduleKey : CourseAiComparisonMetrics.MODULE_KEYS) {
            JsonNode source = rawByKey.get(moduleKey);
            ObjectNode module = modules.addObject();
            module.put("moduleKey", moduleKey);
            if (source == null) {
                module.put("position", "AT_PAR");
                module.put("finding", "");
                module.putArray("evidence");
                continue;
            }
            module.put("position", normalizePosition(source.path("position").asText("")));
            module.put("finding", source.path("finding").asText(""));
            ArrayNode evidence = module.putArray("evidence");
            for (JsonNode ev : source.path("evidence")) {
                String metric = ev.path("metric").asText("");
                if (!CourseAiComparisonMetrics.isKnown(metric)) {
                    continue;
                }
                ObjectNode evidenceNode = evidence.addObject();
                evidenceNode.put("metric", metric);
                evidenceNode.set("target", numberOrNull(ev.get("target")));
                evidenceNode.set("peerMedian", numberOrNull(ev.get("peerMedian")));
                String bestPeer = ev.path("bestPeer").asText("");
                evidenceNode.put("bestPeer", bestPeer.isBlank() ? null : bestPeer);
            }
        }

        out.set("strengths", stringArray(raw.path("strengths")));
        out.set("weaknesses", stringArray(raw.path("weaknesses")));

        // --- biggestGaps: metric phải có thật ---
        ArrayNode biggestGaps = out.putArray("biggestGaps");
        for (JsonNode gap : raw.path("biggestGaps")) {
            String metric = gap.path("metric").asText("");
            if (!CourseAiComparisonMetrics.isKnown(metric)) {
                continue;
            }
            ObjectNode gapNode = biggestGaps.addObject();
            gapNode.put("moduleKey", gap.path("moduleKey").asText(""));
            gapNode.put("metric", metric);
            gapNode.set("target", numberOrNull(gap.get("target")));
            gapNode.set("peerMedian", numberOrNull(gap.get("peerMedian")));
            gapNode.set("gap", numberOrNull(gap.get("gap")));
        }

        // --- benchmarkPeers: courseId phải nằm trong peers ---
        ArrayNode benchmarkPeers = out.putArray("benchmarkPeers");
        for (JsonNode peer : raw.path("benchmarkPeers")) {
            long courseId = peer.path("courseId").asLong(-1);
            if (!peerIds.contains(courseId)) {
                continue;
            }
            ObjectNode peerNode = benchmarkPeers.addObject();
            peerNode.put("courseId", courseId);
            peerNode.put("courseName", peer.path("courseName").asText(""));
            peerNode.put("why", peer.path("why").asText(""));
        }

        // --- recommendations: tối đa 5, moduleKey phải hợp lệ ---
        ArrayNode recommendations = out.putArray("recommendations");
        int count = 0;
        for (JsonNode rec : raw.path("recommendations")) {
            if (count >= 5) break;
            String moduleKey = rec.path("moduleKey").asText("");
            if (!CourseAiComparisonMetrics.MODULE_KEYS.contains(moduleKey)) {
                continue;
            }
            ObjectNode recNode = recommendations.addObject();
            recNode.put("priority", normalizePriority(rec.path("priority").asText("")));
            recNode.put("moduleKey", moduleKey);
            recNode.put("action", rec.path("action").asText(""));
            recNode.put("basedOn", rec.path("basedOn").asText(""));
            recNode.put("expectedImpact", rec.path("expectedImpact").asText(""));
            count++;
        }

        out.set("dataCaveats", stringArray(raw.path("dataCaveats")));

        // Cảnh báo tự động khi dữ liệu không tương đương (ít học viên hơn 5 lần).
        ArrayNode caveats = (ArrayNode) out.get("dataCaveats");
        for (String caveat : autoCaveats(peers)) {
            caveats.add(caveat);
        }

        return out;
    }

    private JsonNode sanitizeFollowUp(JsonNode raw, CourseComparisonItem target, List<CourseComparisonItem> peers) {
        if (raw == null || !raw.isObject()) {
            throw new BadRequestException("The AI returned an unreadable answer. Please try again.");
        }
        Set<Long> validIds = new LinkedHashSet<>();
        validIds.add(target.courseId());
        for (CourseComparisonItem peer : peers) {
            validIds.add(peer.courseId());
        }
        ObjectNode out = objectMapper.createObjectNode();
        out.put("reply", raw.path("reply").asText(""));
        ArrayNode ids = out.putArray("referencedCourseIds");
        for (JsonNode id : raw.path("referencedCourseIds")) {
            long value = id.asLong(-1);
            if (validIds.contains(value)) {
                ids.add(value);
            }
        }
        ArrayNode metrics = out.putArray("referencedMetrics");
        for (JsonNode metric : raw.path("referencedMetrics")) {
            String key = metric.asText("");
            if (CourseAiComparisonMetrics.isKnown(key)) {
                metrics.add(key);
            }
        }
        ArrayNode followUps = out.putArray("followUps");
        int count = 0;
        for (JsonNode question : raw.path("followUps")) {
            if (count >= 3) break;
            String text = question.asText("").trim();
            if (text.isEmpty()) continue;
            followUps.add(text);
            count++;
        }
        return out;
    }

    /** Cảnh báo khi số học viên lệch quá nhiều giữa target và peers. */
    private List<String> autoCaveats(List<CourseComparisonItem> peers) {
        List<String> caveats = new ArrayList<>();
        if (peers.isEmpty()) {
            caveats.add("No peer course was available, so the analysis only describes the target course itself.");
            return caveats;
        }
        long min = peers.stream().mapToLong(CourseComparisonItem::learnerCount).min().orElse(0);
        long max = peers.stream().mapToLong(CourseComparisonItem::learnerCount).max().orElse(0);
        if (max > 0 && (double) max / Math.max(1, min) > LEARNER_RATIO_LIMIT) {
            caveats.add("Peer courses have very different learner counts (from " + min + " to " + max
                    + "), so absolute numbers are not directly comparable.");
        }
        return caveats;
    }

    private String normalizeVerdict(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase();
        return switch (value) {
            case "STRONGER", "SIMILAR", "WEAKER" -> value;
            default -> "SIMILAR";
        };
    }

    private String normalizePosition(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase();
        return switch (value) {
            case "ABOVE", "BELOW" -> value;
            default -> "AT_PAR";
        };
    }

    private String normalizePriority(String raw) {
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

    private JsonNode numberOrNull(JsonNode node) {
        if (node == null || node.isNull()) {
            return objectMapper.nullNode();
        }
        if (node.isNumber()) {
            return node;
        }
        if (node.isTextual()) {
            try {
                return objectMapper.getNodeFactory().numberNode(Double.parseDouble(node.asText().trim()));
            } catch (NumberFormatException e) {
                return objectMapper.nullNode();
            }
        }
        return objectMapper.nullNode();
    }

    // =====================================================================
    // Helper
    // =====================================================================

    /** Cắt focus: tối đa {@link #MAX_FOCUS_LENGTH} ký tự, bỏ xuống dòng. */
    static String sanitize(String focus) {
        if (focus == null) return "";
        String cleaned = focus.replaceAll("[\\r\\n]+", " ").replaceAll("\\s+", " ").trim();
        return truncate(cleaned, MAX_FOCUS_LENGTH);
    }

    private static String truncate(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max).trim();
    }

    private String json(Object node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            log.warn("Could not serialize the comparison payload", e);
            return "{}";
        }
    }
}
