package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** NEW (anti-cheat): bao cao vi pham cua 1 ky thi (hien trong trang Thong ke). */
@Getter @Setter
public class ExamIntegrityReportDTO {

    private Long examId;
    private String examTitle;
    private boolean antiCheatEnabled;

    private int totalAttempts;
    private int flaggedAttempts;
    private int extremeDurationAttempts;   // so luot nop duoi 20% thoi luong (canh bao)
    private int totalViolations;
    private Map<String, Integer> totalsByType;

    private List<Row> rows;

    /** 1 dong = 1 luot lam bai, kem toan bo thong tin sinh vien hien co. */
    @Getter @Setter
    public static class Row {
        // --- thong tin sinh vien (tat ca truong User hien co) ---
        private Long studentId;
        private String studentName;
        private String email;
        private String username;
        private String employeeCode;
        private String phone;
        private String description;
        private boolean guest;

        // --- thong tin luot thi ---
        private Long attemptId;
        private int attemptNumber;
        private ExamAttemptStatus status;
        private Instant startedAt;
        private Instant submittedAt;
        private BigDecimal objectiveScore;
        private BigDecimal finalScore;
        private BigDecimal maxScore;

        // --- vi pham ---
        private int totalViolations;
        private int tabSwitchCount;       // TAB_HIDDEN
        private int windowBlurCount;      // WINDOW_BLUR
        private int fullscreenExitCount;
        private int copyPasteCount;       // COPY + CUT + PASTE
        private int contextMenuCount;
        private int shortcutCount;        // DEVTOOLS_KEY + PRINT_ATTEMPT
        private int multiSessionCount;
        private int cameraOffCount;        // CAMERA_OFF
        private int cameraCoveredCount;    // CAMERA_COVERED
        private int faceMissingCount;      // FACE_MISSING (roi khoi camera)
        private int multipleFacesCount;    // MULTIPLE_FACES
        private boolean extremeDuration;    // nop bai duoi 20% thoi luong (chi canh bao, khong gan co)
        private int duplicateContentCount;  // so cau co noi dung trung voi sinh vien khac (gan co)
        private List<DuplicateMatch> duplicateMatches = new ArrayList<>();
        private int headTurnedCount;       // HEAD_TURNED (quay dau > 45 do)
        private int differentPersonCount;  // DIFFERENT_PERSON (khuon mat khac anh luc vao thi)
        private boolean hasEntryPhoto;     // da chup anh luc vao thi
        private int totalAwaySeconds;
        private Instant lastViolationAt;
        private boolean flagged;

        private Long durationSeconds;            // thoi gian lam bai thuc te (giay)
    }

    /** Mot cau tra loi trung/giong bai cua sinh vien khac (tu ExamSimilarityService). */
    @Getter @Setter
    public static class DuplicateMatch {
        private Long questionId;
        private int questionOrder;
        private Long otherAttemptId;
        private String otherStudentName;
        private double similarity;      // 0-100
        private String matchType;
        private String explanation;
    }

    /** Chi tiet tung su kien cua 1 luot thi. */
    @Getter @Setter
    public static class EventDTO {
        private Long id;
        private String type;
        private Instant occurredAt;
        private Integer durationSeconds;
        private String detail;
        private String userAgent;
        private String ipAddress;
        /** Anh bang chung (data URL) - chi co voi su kien camera. */
        private String snapshot;
    }

    /** Anh chup luc vao thi. */
    @Getter @Setter
    public static class EntryPhotoDTO {
        private String imageData;
        private Instant capturedAt;
    }
}
