package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;

import java.time.Duration;
import java.time.Instant;

public final class ExamAttemptLifecycle {

    public static final long GRACE_SECONDS = 5;

    public enum SaveAction {
        IGNORE,
        APPLY,
        EXPIRE
    }

    public enum SubmitAction {
        RETURN_CURRENT,
        GRADE_WITH_ANSWERS,
        GRADE_AS_EXPIRED
    }

    private ExamAttemptLifecycle() {
    }

    public static Instant deadline(Instant startedAt, int durationMinutes) {
        return startedAt.plus(Duration.ofMinutes(durationMinutes));
    }

    public static boolean isExpired(Instant startedAt, int durationMinutes, Instant now) {
        return isExpired(deadline(startedAt, durationMinutes), now);
    }

    public static boolean isExpired(Instant deadline, Instant now) {
        return !now.isBefore(deadline.plusSeconds(GRACE_SECONDS));
    }

    public static boolean isFinished(ExamAttemptStatus status) {
        return status != ExamAttemptStatus.NOT_STARTED && status != ExamAttemptStatus.IN_PROGRESS;
    }

    public static boolean canTransition(ExamAttemptStatus from, ExamAttemptStatus to) {
        if (from == null || to == null) {
            return false;
        }
        return switch (from) {
            case NOT_STARTED -> to == ExamAttemptStatus.IN_PROGRESS;
            case IN_PROGRESS -> to == ExamAttemptStatus.SUBMITTED
                    || to == ExamAttemptStatus.PENDING_REVIEW
                    || to == ExamAttemptStatus.EXPIRED;
            case PENDING_REVIEW -> to == ExamAttemptStatus.SUBMITTED;
            case SUBMITTED, EXPIRED -> false;
        };
    }

    public static ExamAttemptStatus finalStatus(boolean hasEssay, boolean expired) {
        if (expired) {
            return ExamAttemptStatus.EXPIRED;
        }
        return hasEssay ? ExamAttemptStatus.PENDING_REVIEW : ExamAttemptStatus.SUBMITTED;
    }

    public static SaveAction decideSave(ExamAttemptStatus status, boolean expired) {
        if (status != ExamAttemptStatus.IN_PROGRESS) {
            return SaveAction.IGNORE;
        }
        return expired ? SaveAction.EXPIRE : SaveAction.APPLY;
    }

    public static SubmitAction decideSubmit(ExamAttemptStatus status, boolean expired) {
        if (status != ExamAttemptStatus.IN_PROGRESS) {
            return SubmitAction.RETURN_CURRENT;
        }
        return expired ? SubmitAction.GRADE_AS_EXPIRED : SubmitAction.GRADE_WITH_ANSWERS;
    }
}
