package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.AnonymousSession;
import com.example.starter_project_2025.system.exam.domain.AnonymousSessionRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Tra ve email that cua thi sinh tu do (guest).
 *
 * Guest user duoc tao an danh trong bang user, neu email thieu sinh trung
 * email mot account that thi email luu trong user se la {@code guest-xxx@anon.invalid}
 * (khong gui duoc). Email that chi nam trong {@code anonymous_session.guest_email}
 * va {@code exam_invitation.guest_email}, nen phai tra loi tu day.
 */
@Service
@RequiredArgsConstructor
public class GuestEmailResolver {

    private final AnonymousSessionRepository sessionRepository;

    /**
     * @return email that cua guest, hoac null neu khong tim thay.
     */
    @Transactional(readOnly = true)
    public String resolveGuestEmail(ExamAttempt attempt) {
        if (attempt == null
                || attempt.getStudent() == null
                || !Boolean.TRUE.equals(attempt.getStudent().getIsGuest())
                || attempt.getExam() == null
                || attempt.getExam().getId() == null) {
            return null;
        }

        Long guestUserId = attempt.getStudent().getId();
        Long examId = attempt.getExam().getId();

        List<AnonymousSession> sessions = sessionRepository
                .findByGuestUserIdAndExamIdOrderByAccessedAtDesc(guestUserId, examId);

        for (AnonymousSession session : sessions) {
            String email = session.getGuestEmail();
            if (email != null && !email.isBlank()) {
                return email.trim();
            }
        }

        // Fallback: email tren user van dung khi email that khong bi trung account.
        String userEmail = attempt.getStudent().getEmail();
        if (userEmail != null
                && !userEmail.isBlank()
                && !userEmail.toLowerCase().endsWith("@anon.invalid")) {
            return userEmail.trim();
        }

        return null;
    }
}
