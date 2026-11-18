package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.dto.ExamItemAnalysisDTO.CodeStatDTO;
import com.example.starter_project_2025.system.exam.dto.ExamItemAnalysisDTO.CodeTestStatDTO;
import com.example.starter_project_2025.system.exam.dto.ExamItemAnalysisDTO.ItemDTO;
import com.example.starter_project_2025.system.exam.dto.ExamItemAnalysisDTO.OptionStatDTO;
import com.example.starter_project_2025.system.question.domain.QuestionType;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Tinh item analysis thuan tuy (khong phu thuoc DB) de de kiem thu.
 * Moi cau tra loi duoc quy ve ty le diem ratio trong [0,1] (null = chua co diem).
 */
public final class ItemAnalysisCalculator {

    public static final int MIN_ATTEMPTS_FOR_DISCRIMINATION = 10;
    /** Do lech chuan toi thieu cua diem tong (ty le 0..1) de D co y nghia. */
    private static final double MIN_SCORE_STDDEV = 0.05;
    private static final double GROUP_FRACTION = 0.27;
    private static final double FULL = 0.9999;

    private ItemAnalysisCalculator() {
    }

    public record OptionInfo(long sourceOptionId, String content, boolean correct) {
    }

    public record TestInfo(boolean visible, List<String> inputs, String expected) {
    }

    public record ItemResponse(
            long sourceQuestionId,
            String content,
            QuestionType type,
            int points,
            List<OptionInfo> options,
            Set<Long> selected,
            boolean answered,
            Double ratio,
            /** Cau coding: thong tin tung test theo thu tu khai bao (null neu khong phai coding). */
            List<TestInfo> testInfos,
            /** Cau coding: trang thai tung test luc cham (null/rong neu chua luu). */
            List<String> testStatuses) {
    }

    public record AttemptResponses(long attemptId, List<ItemResponse> items) {
    }

    private static final class Acc {
        String content;
        QuestionType type;
        int points;
        int attempts;
        int answered;
        int fully;
        double ratioSum;
        int ratioCount;
        double upperSum;
        int upperCount;
        double lowerSum;
        int lowerCount;
        final Map<Long, OptionInfo> options = new LinkedHashMap<>();
        final Map<Long, Integer> picks = new LinkedHashMap<>();
        List<TestInfo> testInfos;
        int[] evaluated;
        int[] passedTests;
        List<Map<String, Integer>> statusCounts;
        int codeGraded;
        int compileErrors;
        int noCode;
        int timeouts;
        int runtimeErrors;
    }

    /** Diem tong (ty le 0..1, co trong so) cua tung luot thi. */
    private static Map<Long, Double> rawScores(List<AttemptResponses> sorted) {
        Map<Long, Double> raw = new LinkedHashMap<>();
        for (AttemptResponses a : sorted) {
            double num = 0;
            double den = 0;
            for (ItemResponse r : a.items()) {
                if (r.ratio() == null) {
                    continue;
                }
                num += r.ratio() * r.points();
                den += r.points();
            }
            if (den > 0) {
                raw.put(a.attemptId(), num / den);
            }
        }
        return raw;
    }

    /**
     * Ly do khong nen tin vao do phan biet D, hoac null neu dang tin cay:
     * TOO_FEW_ATTEMPTS (it bai), SCORES_TOO_CLOSE (diem gan nhu bang nhau),
     * GROUPS_OVERLAP (nhom gioi va nhom yeu bi trung/cham diem nhau).
     */
    public static String discriminationProblem(List<AttemptResponses> attempts) {
        List<AttemptResponses> sorted = new ArrayList<>(attempts);
        sorted.sort(Comparator.comparingLong(AttemptResponses::attemptId));
        return discriminationProblem(rawScores(sorted));
    }

    static String discriminationProblem(Map<Long, Double> raw) {
        if (raw.size() < MIN_ATTEMPTS_FOR_DISCRIMINATION) {
            return "TOO_FEW_ATTEMPTS";
        }
        double mean = raw.values().stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double variance = raw.values().stream().mapToDouble(v -> (v - mean) * (v - mean)).sum() / raw.size();
        if (Math.sqrt(variance) < MIN_SCORE_STDDEV) {
            return "SCORES_TOO_CLOSE";
        }
        List<Double> ranked = new ArrayList<>(raw.values());
        ranked.sort(Comparator.reverseOrder());
        int k = Math.max(1, (int) Math.round(ranked.size() * GROUP_FRACTION));
        double upperMin = ranked.get(k - 1);
        double lowerMax = ranked.get(ranked.size() - k);
        return upperMin <= lowerMax + 1e-9 ? "GROUPS_OVERLAP" : null;
    }

    public static List<ItemDTO> analyze(List<AttemptResponses> attempts) {
        List<AttemptResponses> sorted = new ArrayList<>(attempts);
        sorted.sort(Comparator.comparingLong(AttemptResponses::attemptId));

        Map<Long, Double> raw = rawScores(sorted);

        Set<Long> upper = new HashSet<>();
        Set<Long> lower = new HashSet<>();
        boolean canDiscriminate = discriminationProblem(raw) == null;
        if (canDiscriminate) {
            List<Map.Entry<Long, Double>> ranked = new ArrayList<>(raw.entrySet());
            ranked.sort((x, y) -> {
                int c = Double.compare(y.getValue(), x.getValue());
                return c != 0 ? c : Long.compare(x.getKey(), y.getKey());
            });
            int k = Math.max(1, (int) Math.round(ranked.size() * GROUP_FRACTION));
            for (int i = 0; i < k; i++) {
                upper.add(ranked.get(i).getKey());
                lower.add(ranked.get(ranked.size() - 1 - i).getKey());
            }
        }

        Map<Long, Acc> byQuestion = new LinkedHashMap<>();
        for (AttemptResponses a : sorted) {
            for (ItemResponse r : a.items()) {
                Acc acc = byQuestion.computeIfAbsent(r.sourceQuestionId(), id -> {
                    Acc n = new Acc();
                    n.content = r.content();
                    n.type = r.type();
                    n.points = r.points();
                    return n;
                });
                acc.attempts++;
                if (r.answered()) {
                    acc.answered++;
                }
                if (r.ratio() != null) {
                    acc.ratioSum += r.ratio();
                    acc.ratioCount++;
                    if (r.ratio() >= FULL) {
                        acc.fully++;
                    }
                    if (upper.contains(a.attemptId())) {
                        acc.upperSum += r.ratio();
                        acc.upperCount++;
                    }
                    if (lower.contains(a.attemptId())) {
                        acc.lowerSum += r.ratio();
                        acc.lowerCount++;
                    }
                }
                if (r.type() == QuestionType.CODING && r.testInfos() != null) {
                    if (acc.testInfos == null) {
                        acc.testInfos = r.testInfos();
                        int n = r.testInfos().size();
                        acc.evaluated = new int[n];
                        acc.passedTests = new int[n];
                        acc.statusCounts = new ArrayList<>();
                        for (int i = 0; i < n; i++) {
                            acc.statusCounts.add(new LinkedHashMap<>());
                        }
                    }
                    List<String> statuses = r.testStatuses();
                    if (statuses != null && !statuses.isEmpty()) {
                        acc.codeGraded++;
                        int n = Math.min(statuses.size(), acc.testInfos.size());
                        for (int i = 0; i < n; i++) {
                            String st = statuses.get(i);
                            acc.evaluated[i]++;
                            if ("OK".equals(st)) {
                                acc.passedTests[i]++;
                            }
                            acc.statusCounts.get(i).merge(st, 1, Integer::sum);
                        }
                        if (statuses.contains("COMPILE_ERROR")) {
                            acc.compileErrors++;
                        }
                        if (statuses.contains("NO_CODE")) {
                            acc.noCode++;
                        }
                        if (statuses.contains("TIME_LIMIT")) {
                            acc.timeouts++;
                        }
                        if (statuses.contains("RUNTIME_ERROR")) {
                            acc.runtimeErrors++;
                        }
                    }
                }
                if (r.type() == QuestionType.MULTIPLE_CHOICE) {
                    for (OptionInfo o : r.options()) {
                        acc.options.putIfAbsent(o.sourceOptionId(), o);
                    }
                    for (Long id : r.selected()) {
                        acc.picks.merge(id, 1, Integer::sum);
                    }
                }
            }
        }

        List<ItemDTO> result = new ArrayList<>();
        int order = 0;
        for (Map.Entry<Long, Acc> e : byQuestion.entrySet()) {
            Acc a = e.getValue();
            order++;
            Double p = a.ratioCount == 0 ? null : a.ratioSum / a.ratioCount;
            Double d = (a.upperCount > 0 && a.lowerCount > 0)
                    ? a.upperSum / a.upperCount - a.lowerSum / a.lowerCount
                    : null;
            String diffLevel = difficultyLevel(p);
            String discLevel = discriminationLevel(d);

            List<OptionStatDTO> options = new ArrayList<>();
            for (OptionInfo o : a.options.values()) {
                int count = a.picks.getOrDefault(o.sourceOptionId(), 0);
                options.add(new OptionStatDTO(o.sourceOptionId(), o.content(), o.correct(), count,
                        a.attempts == 0 ? null : round(count / (double) a.attempts)));
            }

            List<String> flags = new ArrayList<>();
            if (d != null && d < 0) {
                flags.add("NEGATIVE_DISCRIMINATION");
            } else if (d != null && d < 0.2 && "MEDIUM".equals(diffLevel)) {
                flags.add("LOW_DISCRIMINATION");
            }
            if (p != null && a.ratioCount >= 5 && p < 0.1) {
                flags.add("NOBODY_CORRECT");
            }
            if (a.attempts >= 5 && a.type == QuestionType.MULTIPLE_CHOICE
                    && options.stream().anyMatch(o -> !o.correct() && o.selectedCount() == 0)) {
                flags.add("UNUSED_DISTRACTOR");
            }

            CodeStatDTO code = null;
            if (a.type == QuestionType.CODING && a.testInfos != null) {
                List<CodeTestStatDTO> tests = new ArrayList<>();
                for (int i = 0; i < a.testInfos.size(); i++) {
                    TestInfo info = a.testInfos.get(i);
                    tests.add(new CodeTestStatDTO(i, info.visible(), info.inputs(), info.expected(),
                            a.evaluated[i], a.passedTests[i],
                            a.evaluated[i] == 0 ? null : round(a.passedTests[i] / (double) a.evaluated[i]),
                            a.statusCounts.get(i)));
                }
                code = new CodeStatDTO(a.codeGraded, a.compileErrors, a.noCode, a.timeouts, a.runtimeErrors, tests);
            }

            result.add(new ItemDTO(
                    e.getKey(), order, a.content, a.type, a.points,
                    a.attempts, a.answered,
                    a.attempts == 0 ? null : round(a.answered / (double) a.attempts),
                    a.fully,
                    a.ratioCount == 0 ? null : round(a.fully / (double) a.ratioCount),
                    p == null ? null : round(p), diffLevel,
                    d == null ? null : round(d), discLevel,
                    flags, options, code));
        }
        return result;
    }

    static String difficultyLevel(Double p) {
        if (p == null) {
            return null;
        }
        if (p >= 0.8) {
            return "EASY";
        }
        return p >= 0.3 ? "MEDIUM" : "HARD";
    }

    static String discriminationLevel(Double d) {
        if (d == null) {
            return null;
        }
        if (d >= 0.3) {
            return "GOOD";
        }
        if (d >= 0.2) {
            return "FAIR";
        }
        return d >= 0 ? "POOR" : "NEGATIVE";
    }

    static double round(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}
