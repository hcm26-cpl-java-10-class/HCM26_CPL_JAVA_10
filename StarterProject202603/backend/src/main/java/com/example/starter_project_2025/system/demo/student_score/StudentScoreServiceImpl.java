package com.example.starter_project_2025.system.demo.student_score;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class StudentScoreServiceImpl
        extends BaseCrudServiceImpl<StudentScore, Long, StudentScoreDTO, StudentScoreFilter>
        implements StudentScoreService {

    StudentScoreMapper studentScoreMapper;
    StudentScoreRepository studentScoreRepository;

    @Override
    protected BaseCrudRepository<StudentScore, Long> getRepository() {
        return studentScoreRepository;
    }

    @Override
    protected BaseCrudMapper<StudentScore, StudentScoreDTO> getMapper() {
        return studentScoreMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"studentCode", "studentName", "className"};
    }

    @Override
    protected void beforeCreate(StudentScore score, StudentScoreDTO request, ValidationContext ctx) {

        if (studentScoreRepository.existsByStudentCode(request.getStudentCode())) {
            ctx.add("studentCode", "Student code already exists");
        }

        score.setScores(normalizeScores(score.getScores()));
    }

    @Override
    protected void afterCreate(StudentScore score, StudentScoreDTO request) {
        applyOverallScore(score);
    }

    @Override
    protected void beforeUpdate(StudentScore score, StudentScoreDTO request, ValidationContext ctx) {

        if (request.getStudentCode() != null &&
                !request.getStudentCode().equals(score.getStudentCode()) &&
                studentScoreRepository.existsByStudentCode(request.getStudentCode())) {

            ctx.add("studentCode", "Student code already exists");
        }

        if (request.getScores() != null) {
            request.setScores(normalizeScores(request.getScores()));
        } else {
            score.setScores(normalizeScores(score.getScores()));
        }
    }

    @Override
    protected void afterUpdate(StudentScore score, StudentScoreDTO request) {
        applyOverallScore(score);
    }

    private void applyOverallScore(StudentScore score) {

        Map<String, BigDecimal> normalizedScores = normalizeScores(score.getScores());
        score.setScores(normalizedScores);

        if (normalizedScores.isEmpty()) {
            score.setOverallScore(null);
            return;
        }

        BigDecimal total = normalizedScores.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal average = total.divide(
                BigDecimal.valueOf(normalizedScores.size()),
                2,
                RoundingMode.HALF_UP
        );

        score.setOverallScore(average);
    }

    private Map<String, BigDecimal> normalizeScores(Map<String, BigDecimal> rawScores) {

        if (rawScores == null || rawScores.isEmpty()) {
            return new LinkedHashMap<>();
        }

        Map<String, BigDecimal> normalized = new LinkedHashMap<>();

        for (Map.Entry<String, BigDecimal> entry : rawScores.entrySet()) {

            String key = entry.getKey();
            BigDecimal value = entry.getValue();

            if (key == null || key.isBlank() || value == null) {
                continue;
            }

            normalized.put(key.trim(), value.setScale(2, RoundingMode.HALF_UP));
        }

        return normalized;
    }
}
