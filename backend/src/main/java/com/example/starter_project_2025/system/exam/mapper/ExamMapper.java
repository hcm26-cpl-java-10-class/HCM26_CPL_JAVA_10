package com.example.starter_project_2025.system.exam.mapper;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.service.ExamScoring;
import com.example.starter_project_2025.system.exam.service.ExamTypePolicy;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.question.domain.Question;
import com.example.starter_project_2025.system.question.mapper.QuestionMapper;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ExamMapper implements BaseCrudMapper<Exam, ExamDTO> {

    private final QuestionMapper questionMapper;
    private final UserRepository userRepository;
    private final ExamAttemptRepository attemptRepository;

    @Override
    public Exam toEntity(ExamDTO dto) {
        Exam e = new Exam();
        e.setIsActive(dto.getIsActive() == null ? Boolean.TRUE : dto.getIsActive());
        apply(e, dto);
        return e;
    }

    @Override
    public ExamDTO toResponse(Exam e) {
        ExamDTO d = new ExamDTO();
        d.setId(e.getId());
        d.setIsActive(e.getIsActive());
        d.setCreatedAt(e.getCreatedAt());
        d.setUpdatedAt(e.getUpdatedAt());
        d.setCreatedBy(e.getCreatedBy());
        d.setCreatedByName(creatorName(e.getCreatedBy()));
        d.setPendingGradingCount(pendingGrading(e.getId()));
        d.setHasAttempts(e.getId() != null && attemptRepository.existsByExam_Id(e.getId()));
        d.setUpdatedBy(e.getUpdatedBy());
        d.setTitle(e.getTitle());
        d.setDurationMinutes(e.getDurationMinutes());

        d.setStartTime(e.getStartTime());
        d.setEndTime(e.getEndTime());
        d.setMaxAttempts(e.getMaxAttempts());
        d.setShuffleQuestions(e.getShuffleQuestions());
        d.setShuffleOptions(e.getShuffleOptions());
        d.setShowAnswersAfterExam(e.getShowAnswersAfterExam());
        d.setPassScore(e.getPassScore());
        d.setMaxScore(ExamScoring.effectiveMax(e.getMaxScore()));
        d.setLatePolicy(e.getLatePolicy());
        d.setLatePenaltyPercent(e.getLatePenaltyPercent());
        d.setLateGraceMinutes(e.getLateGraceMinutes());
        d.setResultVisibility(e.getResultVisibility());
        d.setExamType(ExamTypePolicy.effective(e.getExamType()));
        d.setCategory(e.getCategory() == null ? ExamCategory.ASSIGNMENT : e.getCategory());

        List<Question> sorted = e.getQuestions().stream()
                .sorted(Comparator.comparing(Question::getId)).toList();
        d.setQuestionIds(sorted.stream().map(Question::getId).toList());
        d.setQuestions(sorted.stream().map(questionMapper::toResponse).toList());
        d.setTotalPoints(sorted.stream().mapToInt(Question::getPoints).sum());
        // CHANGED: chi nguoi co EXAM_UPDATE (giao vien) moi thay accessCode; nguoi khac chi thay hasPassword
        d.setAccessCode(canSeeAccessCode() ? e.getAccessCode() : null);
        // NEW (anti-cheat)
        d.setAntiCheatEnabled(Boolean.TRUE.equals(e.getAntiCheatEnabled()));
        d.setDetectTabSwitch(Boolean.TRUE.equals(e.getDetectTabSwitch()));
        d.setBlockCopyPaste(Boolean.TRUE.equals(e.getBlockCopyPaste()));
        d.setRequireFullscreen(Boolean.TRUE.equals(e.getRequireFullscreen()));
        d.setSingleSession(Boolean.TRUE.equals(e.getSingleSession()));
        d.setCameraProctoring(Boolean.TRUE.equals(e.getCameraProctoring()));
        d.setNotifyOnViolation(Boolean.TRUE.equals(e.getNotifyOnViolation()));
        d.setHasPassword(e.getAccessCode() != null && !e.getAccessCode().trim().isEmpty());
        return d;
    }

    @Override
    public void update(Exam e, ExamDTO dto) {
        if (dto.getIsActive() != null) e.setIsActive(dto.getIsActive());
        apply(e, dto);
    }

    /** So bai dang cho cham (PENDING_REVIEW hoac EXPIRED); 0 neu khong dem duoc. */
    private long pendingGrading(Long examId) {
        if (examId == null) return 0L;
        try {
            return attemptRepository.countByExam_IdAndStatusIn(
                    examId, java.util.List.of(ExamAttemptStatus.PENDING_REVIEW, ExamAttemptStatus.EXPIRED));
        } catch (RuntimeException ex) {
            return 0L;
        }
    }

    /** Ten day du cua nguoi tao; null neu khong tim thay (du lieu cu). */
    private String creatorName(Long userId) {
        if (userId == null) return null;
        try {
            return userRepository.findById(userId)
                    .map(u -> {
                        String name = u.getFullName();
                        return name == null || name.isBlank() ? u.getEmail() : name.trim();
                    })
                    .orElse(null);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    // NEW: kiem tra nguoi dang goi co quyen sua de thi khong
    private static boolean canSeeAccessCode() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.isAuthenticated()
                && auth.getAuthorities().stream().anyMatch(a -> "EXAM_UPDATE".equals(a.getAuthority()));
    }

    private void apply(Exam e, ExamDTO d) {
        if (d.getTitle() != null) e.setTitle(d.getTitle().trim());
        if (d.getDurationMinutes() != null) e.setDurationMinutes(d.getDurationMinutes());

        if (d.getStartTime() != null) e.setStartTime(d.getStartTime());
        if (d.getEndTime() != null) e.setEndTime(d.getEndTime());
        if (d.getMaxAttempts() != null) e.setMaxAttempts(d.getMaxAttempts());
        if (d.getShuffleQuestions() != null) e.setShuffleQuestions(d.getShuffleQuestions());
        if (d.getShuffleOptions() != null) e.setShuffleOptions(d.getShuffleOptions());
        if (d.getShowAnswersAfterExam() != null) e.setShowAnswersAfterExam(d.getShowAnswersAfterExam());
        if (d.getPassScore() != null) e.setPassScore(d.getPassScore());
        if (d.getMaxScore() != null) e.setMaxScore(d.getMaxScore());
        else if (e.getMaxScore() == null) e.setMaxScore(ExamScoring.DEFAULT_MAX_SCORE);
        if (d.getLatePolicy() != null) e.setLatePolicy(d.getLatePolicy());
        if (d.getLatePenaltyPercent() != null) e.setLatePenaltyPercent(d.getLatePenaltyPercent());
        if (d.getLateGraceMinutes() != null) e.setLateGraceMinutes(d.getLateGraceMinutes());
        if (d.getResultVisibility() != null) e.setResultVisibility(d.getResultVisibility());
        if (d.getExamType() != null) e.setExamType(d.getExamType());
        if (d.getCategory() != null) e.setCategory(d.getCategory());
        // NEW (anti-cheat)
        if (d.getAntiCheatEnabled() != null) e.setAntiCheatEnabled(d.getAntiCheatEnabled());
        if (d.getDetectTabSwitch() != null) e.setDetectTabSwitch(d.getDetectTabSwitch());
        if (d.getBlockCopyPaste() != null) e.setBlockCopyPaste(d.getBlockCopyPaste());
        if (d.getRequireFullscreen() != null) e.setRequireFullscreen(d.getRequireFullscreen());
        if (d.getSingleSession() != null) e.setSingleSession(d.getSingleSession());
        if (d.getCameraProctoring() != null) e.setCameraProctoring(d.getCameraProctoring());
        if (d.getNotifyOnViolation() != null) e.setNotifyOnViolation(d.getNotifyOnViolation());
        if (d.getAccessCode() != null) {
            String trimmed = d.getAccessCode().trim();
            e.setAccessCode(trimmed.isEmpty() ? null : trimmed);
        }
    }
}
