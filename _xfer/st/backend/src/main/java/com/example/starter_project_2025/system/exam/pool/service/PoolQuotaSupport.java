package com.example.starter_project_2025.system.exam.pool.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.pool.domain.ExamPoolQuestion;
import com.example.starter_project_2025.system.exam.pool.dto.PoolQuotaDTO;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Parsing, validation and drawing for per-difficulty / per-topic selection quotas. */
public final class PoolQuotaSupport {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> DIFFICULTIES = Set.of("EASY", "MEDIUM", "HARD");

    private PoolQuotaSupport() {
    }

    public static String toJson(List<PoolQuotaDTO> quotas) {
        if (quotas == null || quotas.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(quotas);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize quotas", e);
        }
    }

    public static List<PoolQuotaDTO> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return MAPPER.readValue(json, new TypeReference<List<PoolQuotaDTO>>() {
            });
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot read quotas", e);
        }
    }

    /** Normalizes (upper-case difficulty, trimmed lower-case topic) and checks the quotas against the pool. */
    public static List<PoolQuotaDTO> validate(List<PoolQuotaDTO> raw, List<com.example.starter_project_2025.system.question.core.domain.Question> poolQuestions) {
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        List<PoolQuotaDTO> quotas = new ArrayList<>();
        int total = 0;
        for (PoolQuotaDTO q : raw) {
            if (q == null) {
                continue;
            }
            if (q.getCount() < 1) {
                throw new BadRequestException("Each quota must ask for at least 1 question");
            }
            String rawDifficulty = blankToNull(q.getDifficulty());
            final String difficulty = rawDifficulty == null ? null : rawDifficulty.toUpperCase(Locale.ROOT);
            if (difficulty != null && !DIFFICULTIES.contains(difficulty)) {
                throw new BadRequestException("Unknown difficulty in quota: " + q.getDifficulty());
            }
            final String topic = normalizeTopic(q.getTopic());
            if (difficulty == null && topic == null) {
                throw new BadRequestException("Each quota needs a difficulty, a topic, or both");
            }
            long available = poolQuestions.stream()
                    .filter(p -> matches(difficulty, topic,
                            p.getDifficulty() == null ? null : p.getDifficulty().name(), p.getTopic()))
                    .count();
            if (available < q.getCount()) {
                throw new BadRequestException("Quota " + describe(difficulty, topic) + " needs " + q.getCount()
                        + " questions but the pool has only " + available);
            }
            total += q.getCount();
            quotas.add(new PoolQuotaDTO(difficulty, topic, q.getCount()));
        }
        if (total > poolQuestions.size()) {
            throw new BadRequestException("Quotas ask for " + total + " questions in total but the pool has only "
                    + poolQuestions.size());
        }
        return quotas;
    }

    public static int total(List<PoolQuotaDTO> quotas) {
        return quotas.stream().mapToInt(PoolQuotaDTO::getCount).sum();
    }

    /** Draws each quota at random, most specific quota first so broad ones take what is left. */
    public static List<ExamPoolQuestion> draw(List<PoolQuotaDTO> quotas, List<ExamPoolQuestion> candidates) {
        List<PoolQuotaDTO> ordered = new ArrayList<>(quotas);
        ordered.sort(Comparator.comparingInt((PoolQuotaDTO q) ->
                (blankToNull(q.getDifficulty()) != null ? 1 : 0) + (normalizeTopic(q.getTopic()) != null ? 1 : 0)).reversed());

        List<ExamPoolQuestion> remaining = new ArrayList<>(candidates);
        List<ExamPoolQuestion> chosen = new ArrayList<>();
        for (PoolQuotaDTO q : ordered) {
            String difficulty = blankToNull(q.getDifficulty());
            String topic = normalizeTopic(q.getTopic());
            List<ExamPoolQuestion> matching = new ArrayList<>(remaining.stream()
                    .filter(p -> matches(difficulty, topic, p.getDifficulty(), p.getTopic())).toList());
            if (matching.size() < q.getCount()) {
                throw new BadRequestException("Not enough questions for quota " + describe(difficulty, topic)
                        + ". Required: " + q.getCount() + ", available: " + matching.size());
            }
            Collections.shuffle(matching);
            List<ExamPoolQuestion> picked = matching.subList(0, q.getCount());
            chosen.addAll(picked);
            Set<Long> pickedIds = new HashSet<>();
            picked.forEach(p -> pickedIds.add(p.getQuestionId()));
            remaining.removeIf(p -> pickedIds.contains(p.getQuestionId()));
        }
        return chosen;
    }

    static boolean matches(String difficulty, String topic, String questionDifficulty, String questionTopic) {
        if (difficulty != null && !difficulty.equalsIgnoreCase(questionDifficulty == null ? "" : questionDifficulty)) {
            return false;
        }
        if (topic != null) {
            String qt = normalizeTopic(questionTopic);
            return topic.equals(qt);
        }
        return true;
    }

    static String describe(String difficulty, String topic) {
        List<String> parts = new ArrayList<>();
        if (difficulty != null) parts.add(difficulty);
        if (topic != null) parts.add("topic \"" + topic + "\"");
        return String.join(" + ", parts);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String normalizeTopic(String s) {
        String t = blankToNull(s);
        return t == null ? null : t.toLowerCase(Locale.ROOT);
    }
}
