package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.question.dto.QuestionTakerDTO;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
public class ExamAttemptDTO {
    private Long id;
    private Long examId;
    private int attemptNumber;
    private String title;
    private int durationMinutes;
    private int totalPoints;
    private BigDecimal maxScore;
    private BigDecimal passScore;
    /** Dat/Truot theo diem dat da dong bang; chi co khi ket qua da cong bo va da co diem cuoi. */
    private Boolean passed;
    private BigDecimal objectiveScore;
    private BigDecimal finalScore;
    private BigDecimal provisionalScore;

    /** Ket qua da duoc giao vien cong bo (Publish Results) hay chua. */
    private boolean resultPublished;

    private ExamAttemptStatus status;
    private Instant startedAt;
    private Instant officialDeadlineAt;
    private Instant deadlineAt;
    private Instant submittedAt;
    private boolean late;
    private Integer latePenaltyPercentApplied;
    private Integer attemptsUsed;
    private Integer attemptsRemaining;
    private BigDecimal bestScore;
    private List<QuestionTakerDTO> questions;
    private List<AnswerDTO> answers;

    // NEW (anti-cheat): cau hinh giam sat de FE biet can bat tinh nang nao
    private Integrity integrity;

    @Getter
    @Setter
    public static class Integrity {
        private boolean enabled;
        private boolean detectTabSwitch;
        private boolean blockCopyPaste;
        private boolean requireFullscreen;
        private boolean singleSession;
        /** Bat camera giam sat (chup anh vao thi + phat hien tat/che/roi camera, nhieu nguoi). */
        private boolean cameraProctoring;
        /** Hien thong bao cho nguoi thi khi vi pham. */
        private boolean notifyOnViolation;
        /** Da chup anh vao thi chua (chua co thi chua duoc xem de). */
        private boolean entryPhotoDone;
    }

    @Getter
    @Setter
    public static class AnswerDTO {
        private Long questionId;
        private List<Long> selectedOptionIds;
        private String textAnswer;
        private boolean saved;
    }
}
