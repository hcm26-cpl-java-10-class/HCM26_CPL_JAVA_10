package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.student_score.StudentScore;
import com.example.starter_project_2025.system.demo.student_score.StudentScoreRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Order(11)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class StudentScoreDataInitializer implements CommandLineRunner {

    StudentScoreRepository studentScoreRepository;

    @Override
    @Transactional
    public void run(String... args) {
        upsertScore("STU001", "Nguyen Van An", "SE-01", scoreMap(
                entry("quiz1", 8.2),
                entry("assignment", 9.0),
                entry("midterm", 7.8),
                entry("final", 8.7)
        ));

        upsertScore("STU002", "Tran Thi Binh", "SE-01", scoreMap(
                entry("quiz1", 7.5),
                entry("quiz2", 8.0),
                entry("midterm", 8.3),
                entry("final", 8.9)
        ));

        upsertScore("STU003", "Le Minh Chau", "SE-02", scoreMap(
                entry("attendance", 10.0),
                entry("project", 9.2),
                entry("final", 9.4)
        ));

        upsertScore("STU004", "Pham Gia Duy", "SE-02", scoreMap(
                entry("quiz1", 6.8),
                entry("assignment", 7.0),
                entry("midterm", 7.1),
                entry("final", 7.6),
                entry("bonus", 0.5)
        ));

        upsertScore("STU005", "Do Ha Em", "SE-03", scoreMap(
                entry("practice", 9.1),
                entry("final", 8.8)
        ));

        markStatus("STU001", "student@example.com", StudentScore.Status.RELEASED);
        markStatus("STU002", null, StudentScore.Status.REVIEWED);
        markStatus("STU004", null, StudentScore.Status.ADJUSTED);

        log.info("Ensured sample student score data.");
    }

    private void markStatus(String studentCode, String email, StudentScore.Status status) {
        StudentScore entity = studentScoreRepository.findByStudentCode(studentCode).orElseThrow();

        entity.setStudentEmail(email);
        entity.setStatus(status);

        if (entity.isPublished()) {
            entity.setApprovedBy("admin@example.com");
            entity.setReleasedAt(LocalDateTime.now());
        }
        if (status == StudentScore.Status.ADJUSTED) {
            entity.setAdjustmentLog(LocalDateTime.now() + " | admin@example.com | Re-graded after appeal | sample data");
        }

        studentScoreRepository.save(entity);
    }

    private void upsertScore(String studentCode, String studentName, String className, Map<String, BigDecimal> scores) {
        StudentScore entity = studentScoreRepository.findByStudentCode(studentCode)
                .orElseGet(StudentScore::new);

        entity.setStudentCode(studentCode);
        entity.setStudentName(studentName);
        entity.setClassName(className);
        entity.setScores(scores);
        entity.setOverallScore(calculateAverage(scores));
        entity.setIsActive(true);

        studentScoreRepository.save(entity);
    }

    @SafeVarargs
    private final Map<String, BigDecimal> scoreMap(Map.Entry<String, BigDecimal>... entries) {
        Map<String, BigDecimal> map = new LinkedHashMap<>();

        for (Map.Entry<String, BigDecimal> entry : entries) {
            map.put(entry.getKey(), entry.getValue().setScale(2, RoundingMode.HALF_UP));
        }

        return map;
    }

    private Map.Entry<String, BigDecimal> entry(String key, double value) {
        return Map.entry(key, BigDecimal.valueOf(value));
    }

    private BigDecimal calculateAverage(Map<String, BigDecimal> scores) {
        if (scores == null || scores.isEmpty()) {
            return null;
        }

        BigDecimal total = scores.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        return total.divide(BigDecimal.valueOf(scores.size()), 2, RoundingMode.HALF_UP);
    }
}
