package com.example.starter_project_2025.system.exam.pool.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.pool.domain.ExamPoolQuestion;
import com.example.starter_project_2025.system.exam.pool.domain.ExamQuestionPoolVersion;
import com.example.starter_project_2025.system.exam.pool.dto.PoolQuotaDTO;
import com.example.starter_project_2025.system.question.core.domain.Difficulty;
import com.example.starter_project_2025.system.question.core.domain.Question;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PoolQuotaSupportTest {

    private static Question q(long id, Difficulty d, String topic) {
        Question q = new Question();
        q.setId(id);
        q.setDifficulty(d);
        q.setTopic(topic);
        return q;
    }

    private static ExamPoolQuestion pq(long id, String d, String topic, int order) {
        ExamPoolQuestion p = new ExamPoolQuestion();
        p.setQuestionId(id);
        p.setDifficulty(d);
        p.setTopic(topic);
        p.setDisplayOrder(order);
        return p;
    }

    private static List<ExamPoolQuestion> pool() {
        List<ExamPoolQuestion> list = new ArrayList<>();
        for (int i = 0; i < 6; i++) list.add(pq(i, "EASY", i < 3 ? "java" : "sql", i));
        for (int i = 6; i < 10; i++) list.add(pq(i, "HARD", "java", i));
        return list;
    }

    @Test
    void validateNormalizesAndChecksAvailability() {
        List<Question> questions = List.of(q(1, Difficulty.EASY, "Java"), q(2, Difficulty.EASY, "java"), q(3, Difficulty.HARD, "sql"));

        List<PoolQuotaDTO> ok = PoolQuotaSupport.validate(List.of(new PoolQuotaDTO("easy", " JAVA ", 2)), questions);

        assertEquals("EASY", ok.get(0).getDifficulty());
        assertEquals("java", ok.get(0).getTopic());
        assertEquals(2, PoolQuotaSupport.total(ok));
    }

    @Test
    void validateRejectsBadQuotas() {
        List<Question> questions = List.of(q(1, Difficulty.EASY, "java"), q(2, Difficulty.HARD, "sql"));
        assertThrows(BadRequestException.class, () -> PoolQuotaSupport.validate(List.of(new PoolQuotaDTO("EASY", null, 0)), questions));
        assertThrows(BadRequestException.class, () -> PoolQuotaSupport.validate(List.of(new PoolQuotaDTO(null, null, 1)), questions));
        assertThrows(BadRequestException.class, () -> PoolQuotaSupport.validate(List.of(new PoolQuotaDTO("EXPERT", null, 1)), questions));
        assertThrows(BadRequestException.class, () -> PoolQuotaSupport.validate(List.of(new PoolQuotaDTO("EASY", null, 2)), questions));
        assertThrows(BadRequestException.class, () -> PoolQuotaSupport.validate(
                List.of(new PoolQuotaDTO("EASY", null, 1), new PoolQuotaDTO("HARD", null, 1), new PoolQuotaDTO(null, "java", 1)), questions));
    }

    @Test
    void drawGivesExactMixWithoutDuplicates() {
        List<PoolQuotaDTO> quotas = List.of(new PoolQuotaDTO("EASY", null, 3), new PoolQuotaDTO("HARD", null, 2));
        for (int run = 0; run < 30; run++) {
            List<ExamPoolQuestion> out = PoolQuotaSupport.draw(quotas, pool());
            assertEquals(5, out.size());
            assertEquals(3, out.stream().filter(p -> "EASY".equals(p.getDifficulty())).count());
            assertEquals(2, out.stream().filter(p -> "HARD".equals(p.getDifficulty())).count());
            Set<Long> ids = new HashSet<>();
            out.forEach(p -> assertTrue(ids.add(p.getQuestionId())));
        }
    }

    @Test
    void specificQuotaIsDrawnBeforeBroadOne() {
        // 3 EASY+java exist; asking for 3 java (any difficulty) and 3 EASY+java must still work.
        List<PoolQuotaDTO> quotas = List.of(new PoolQuotaDTO(null, "java", 3), new PoolQuotaDTO("EASY", "java", 3));
        for (int run = 0; run < 30; run++) {
            List<ExamPoolQuestion> out = PoolQuotaSupport.draw(quotas, pool());
            assertEquals(6, out.size());
        }
    }

    @Test
    void drawFailsClearlyWhenNotEnough() {
        assertThrows(BadRequestException.class,
                () -> PoolQuotaSupport.draw(List.of(new PoolQuotaDTO("HARD", "sql", 1)), pool()));
    }

    @Test
    void selectionServiceUsesQuotasPerAttempt() {
        ExamQuestionPoolVersion v = new ExamQuestionPoolVersion();
        v.setRandomSelectionEnabled(true);
        v.setShuffleQuestionOrder(false);
        v.setRandomQuestionCount(4);
        v.setQuotasJson(PoolQuotaSupport.toJson(List.of(new PoolQuotaDTO("EASY", "sql", 1), new PoolQuotaDTO("HARD", null, 3))));

        List<ExamPoolQuestion> out = new ExamPoolRandomSelectionService().selectQuestions(v, pool());

        assertEquals(4, out.size());
        assertEquals(1, out.stream().filter(p -> "sql".equals(p.getTopic())).count());
        assertEquals(3, out.stream().filter(p -> "HARD".equals(p.getDifficulty())).count());
    }

    @Test
    void noQuotasKeepsOldRandomBehaviour() {
        ExamQuestionPoolVersion v = new ExamQuestionPoolVersion();
        v.setRandomSelectionEnabled(true);
        v.setShuffleQuestionOrder(true);
        v.setRandomQuestionCount(4);

        assertEquals(4, new ExamPoolRandomSelectionService().selectQuestions(v, pool()).size());
    }
}
