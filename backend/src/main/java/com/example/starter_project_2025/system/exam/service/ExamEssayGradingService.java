package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.EssayGradingDTO;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExamEssayGradingService {

    static final Set<ExamAttemptStatus> NEEDS_REVIEW =
            Set.of(ExamAttemptStatus.PENDING_REVIEW, ExamAttemptStatus.EXPIRED);

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;

    public List<EssayGradingDTO.Summary> listPending(Long examId) {
        requireExam(examId);
        return attemptRepository
                .findFinishedWithQuestionType(examId, NEEDS_REVIEW, QuestionType.ESSAY)
                .stream()
                .map(this::toSummary)
                .toList();
    }

    public EssayGradingDTO.Detail getDetail(Long examId, Long attemptId) {
        Exam exam = requireExam(examId);
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .filter(candidate -> candidate.getExam().getId().equals(examId))
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        if (attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS
                || attempt.getStatus() == ExamAttemptStatus.NOT_STARTED) {
            throw new BadRequestException("Bài làm chưa được nộp");
        }

        EssayGradingDTO.Detail detail = new EssayGradingDTO.Detail();
        detail.setAttemptId(attempt.getId());
        detail.setExamId(examId);
        detail.setExamTitle(exam.getTitle());
        fillStudent(attempt.getStudent(), detail::setStudentId, detail::setStudentName, detail::setStudentEmail);
        detail.setAttemptNumber(attempt.getAttemptNumber());
        detail.setStatus(attempt.getStatus());
        detail.setStartedAt(attempt.getStartedAt());
        detail.setSubmittedAt(attempt.getSubmittedAt());
        detail.setTotalPoints(attempt.getTotalPoints());
        detail.setObjectiveScore(attempt.getObjectiveScore());
        detail.setEssays(attempt.getQuestions().stream()
                .filter(question -> question.getType() == QuestionType.ESSAY)
                .sorted(Comparator.comparingInt(ExamAttemptQuestion::getDisplayOrder))
                .map(question -> toEssayItem(attempt, question))
                .toList());
        return detail;
    }

    private Exam requireExam(Long examId) {
        return examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
    }

    private EssayGradingDTO.Summary toSummary(ExamAttempt attempt) {
        EssayGradingDTO.Summary summary = new EssayGradingDTO.Summary();
        summary.setAttemptId(attempt.getId());
        fillStudent(attempt.getStudent(), summary::setStudentId, summary::setStudentName, summary::setStudentEmail);
        summary.setAttemptNumber(attempt.getAttemptNumber());
        summary.setStatus(attempt.getStatus());
        summary.setSubmittedAt(attempt.getSubmittedAt());
        List<ExamAttemptQuestion> essays = attempt.getQuestions().stream()
                .filter(question -> question.getType() == QuestionType.ESSAY)
                .toList();
        summary.setEssayCount(essays.size());
        summary.setEssayAnswered((int) essays.stream()
                .filter(question -> !answerText(attempt, question).isBlank())
                .count());
        return summary;
    }

    private EssayGradingDTO.EssayItem toEssayItem(ExamAttempt attempt, ExamAttemptQuestion question) {
        EssayGradingDTO.EssayItem item = new EssayGradingDTO.EssayItem();
        item.setQuestionId(question.getSourceQuestionId());
        item.setDisplayOrder(question.getDisplayOrder());
        item.setContent(question.getContent());
        item.setPoints(question.getPoints());
        item.setAnswerText(answerText(attempt, question));
        return item;
    }

    private String answerText(ExamAttempt attempt, ExamAttemptQuestion question) {
        return attempt.getAnswers().stream()
                .filter((ExamAttemptAnswer answer) -> answer.getQuestion().getId().equals(question.getId()))
                .map(ExamAttemptAnswer::getTextAnswer)
                .filter(text -> text != null)
                .findFirst()
                .orElse("");
    }

    private void fillStudent(User student,
                             java.util.function.Consumer<Long> id,
                             java.util.function.Consumer<String> name,
                             java.util.function.Consumer<String> email) {
        if (student == null) {
            return;
        }
        id.accept(student.getId());
        String last = student.getLastName() == null ? "" : student.getLastName().trim();
        name.accept((student.getFirstName() + " " + last).trim());
        email.accept(student.getEmail());
    }
}
