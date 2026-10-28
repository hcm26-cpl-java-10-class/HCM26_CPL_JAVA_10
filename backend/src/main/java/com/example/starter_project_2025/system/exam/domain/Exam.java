package com.example.starter_project_2025.system.exam.domain;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.question.domain.Question;
import jakarta.persistence.*;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "exam")
@ResourcePermission("EXAM")
@ResourceMenu(
        title = "Exams",
        group = "Exam",
        icon = "book-open",
        url = "/exams",
        order = 1,
        permission = "EXAM_READ"
)
@Getter @Setter @NoArgsConstructor
public class Exam extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private int durationMinutes;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    @Column(nullable = false)
    private Integer maxAttempts = 1;

    @Column(nullable = false)
    private Boolean shuffleQuestions = false;

    @Column(nullable = false)
    private Boolean shuffleOptions = false;

    @Column(nullable = false)
    private Boolean showAnswersAfterExam = false;

    @Column(precision = 8, scale = 2)
    private BigDecimal passScore;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal maxScore = BigDecimal.TEN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private LatePolicy latePolicy = LatePolicy.NOT_ALLOWED;

    private Integer latePenaltyPercent;

    @Column(nullable = false)
    private Integer lateGraceMinutes = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ResultVisibility resultVisibility = ResultVisibility.IMMEDIATE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ExamType examType = ExamType.MIXED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ExamCategory category = ExamCategory.ASSESSMENT;

    @Column(length = 100)
    private String accessCode;

    // ===== NEW (anti-cheat): cau hinh chong gian lan theo tung de (mac dinh TAT) =====
    @Column(nullable = false)
    private Boolean antiCheatEnabled = false;

    /** Dem so lan roi tab / chuyen cua so. */
    @Column(nullable = false)
    private Boolean detectTabSwitch = false;

    /** Chan copy/cut/paste/chuot phai/phim tat F12,Ctrl+U,Ctrl+P. */
    @Column(nullable = false)
    private Boolean blockCopyPaste = false;

    /** Yeu cau toan man hinh, ghi lai khi thoat. */
    @Column(nullable = false)
    private Boolean requireFullscreen = false;

    /** Phat hien mo bai thi o nhieu tab/thiet bi. */
    @Column(nullable = false)
    private Boolean singleSession = false;

    @ManyToMany
    @JoinTable(name = "exam_question",
            joinColumns = @JoinColumn(name = "exam_id"),
            inverseJoinColumns = @JoinColumn(name = "question_id"))
    private Set<Question> questions = new HashSet<>();
}
