package com.example.starter_project_2025.system.demo.student_score;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
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

        score.setStatus(StudentScore.Status.DRAFT);
        score.setScores(normalizeScores(score.getScores()));
    }

    @Override
    protected void afterCreate(StudentScore score, StudentScoreDTO request) {
        applyOverallScore(score);
    }

    @Override
    protected void beforeUpdate(StudentScore score, StudentScoreDTO request, ValidationContext ctx) {

        if (score.isPublished()) {
            throw new BadRequestException("Score already released, use an adjustment with a reason instead");
        }

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

        score.setStatus(StudentScore.Status.DRAFT);
    }

    @Override
    protected void afterUpdate(StudentScore score, StudentScoreDTO request) {
        applyOverallScore(score);
    }

    @Override
    protected void beforeDelete(StudentScore score) {
        if (score.isPublished()) {
            throw new BadRequestException("Score already released, it can no longer be deleted");
        }
    }

    public StudentScoreDTO review(Long id) {
        StudentScore score = findOrThrow(id);
        requireStatus(score, "Only DRAFT scores can be reviewed", StudentScore.Status.DRAFT);

        score.setStatus(StudentScore.Status.REVIEWED);
        return studentScoreMapper.toResponse(studentScoreRepository.save(score));
    }

    public StudentScoreDTO release(Long id) {
        StudentScore score = findOrThrow(id);
        requireStatus(score, "Only REVIEWED scores can be released", StudentScore.Status.REVIEWED);

        score.setStatus(StudentScore.Status.RELEASED);
        score.setApprovedBy(currentUser());
        score.setReleasedAt(LocalDateTime.now());
        return studentScoreMapper.toResponse(studentScoreRepository.save(score));
    }

    public StudentScoreDTO adjust(Long id, Map<String, BigDecimal> newScores, String reason) {
        StudentScore score = findOrThrow(id);
        requireStatus(score, "Only released scores can be adjusted",
                StudentScore.Status.RELEASED, StudentScore.Status.ADJUSTED);

        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Reason is required to adjust a released score");
        }

        Map<String, BigDecimal> changes = normalizeScores(newScores);
        if (changes.isEmpty()) {
            throw new BadRequestException("At least one score is required");
        }

        BigDecimal oldOverall = score.getOverallScore();
        Map<String, BigDecimal> merged = new LinkedHashMap<>(normalizeScores(score.getScores()));
        merged.putAll(changes);
        score.setScores(merged);
        applyOverallScore(score);

        String line = LocalDateTime.now() + " | " + currentUser() + " | " + reason.trim().replace("\n", " ")
                + " | overall " + oldOverall + " -> " + score.getOverallScore() + " | changed " + changes;
        score.setAdjustmentLog(score.getAdjustmentLog() == null ? line : score.getAdjustmentLog() + "\n" + line);
        score.setStatus(StudentScore.Status.ADJUSTED);
        score.setApprovedBy(currentUser());

        return studentScoreMapper.toResponse(studentScoreRepository.save(score));
    }

    @Transactional(readOnly = true)
    public List<StudentScoreDTO> findMine() {
        return studentScoreRepository
                .findByStudentEmailIgnoreCaseAndStatusIn(currentUser(),
                        List.of(StudentScore.Status.RELEASED, StudentScore.Status.ADJUSTED))
                .stream()
                .map(studentScoreMapper::toResponse)
                .toList();
    }

    private StudentScore findOrThrow(Long id) {
        return studentScoreRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entity not found"));
    }

    private void requireStatus(StudentScore score, String message, StudentScore.Status... allowed) {
        if (!List.of(allowed).contains(score.getStatus())) {
            throw new BadRequestException(message);
        }
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "system" : auth.getName();
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
