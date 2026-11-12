package com.example.starter_project_2025.system.exam.domain;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.question.domain.Question;
import jakarta.persistence.*;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "exam")
@ResourcePermission("EXAM")
@ResourceMenu(
        title = "Assessments",
        group = "Assessment Management",
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

    // Tinh nang dat lich (start/end) da bi go bo: de thi luon "mo tu do", chi gioi han boi thoi luong, so lan lam va
    // loi moi. Cot start_time / end_time cu van con trong DB nhung khong con duoc ORM doc hay ghi.

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
    private ExamCategory category = ExamCategory.ASSIGNMENT;

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

    /** Giam sat bang camera: chup anh luc vao thi, phat hien tat/che/roi camera, nhieu nguoi. */
    @Column(nullable = false)
    @ColumnDefault("false")
    private Boolean cameraProctoring = false;

    // ---- He so chong gian lan (chon luc tao de thi, khong sua duoc sau do; null = dung mac dinh) ----
    public static final int DEFAULT_HEAD_TURN_ANGLE_DEG = 35;
    public static final int DEFAULT_HEAD_TURN_SECONDS = 2;
    public static final int DEFAULT_FAST_SUBMIT_PERCENT = 20;

    /** Goc quay dau (do) tu day tro len bi tinh la vi pham HEAD_TURNED. */
    private Integer headTurnAngleDeg;
    /** Quay dau lien tuc bao nhieu giay thi bi tinh la vi pham. */
    private Integer headTurnSeconds;
    /** Nop bai nhanh hon bao nhieu % thoi luong bai thi thi bi canh bao. */
    private Integer fastSubmitPercent;

    public int headTurnAngleOrDefault() {
        return headTurnAngleDeg != null ? headTurnAngleDeg : DEFAULT_HEAD_TURN_ANGLE_DEG;
    }

    public int headTurnSecondsOrDefault() {
        return headTurnSeconds != null ? headTurnSeconds : DEFAULT_HEAD_TURN_SECONDS;
    }

    public int fastSubmitPercentOrDefault() {
        return fastSubmitPercent != null ? fastSubmitPercent : DEFAULT_FAST_SUBMIT_PERCENT;
    }

    /** Hien thong bao cho nguoi thi khi he thong ghi nhan vi pham. */
    @Column(nullable = false)
    @ColumnDefault("false")
    private Boolean notifyOnViolation = false;

    /** Course / section / lesson ma bai thi thuoc ve (co the de trong). Xoa course/section/lesson thi chi go lien ket. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private Section section;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    @OnDelete(action = OnDeleteAction.SET_NULL)
    private Lesson lesson;

    @ManyToMany
    @JoinTable(name = "exam_question",
            joinColumns = @JoinColumn(name = "exam_id"),
            inverseJoinColumns = @JoinColumn(name = "question_id"))
    private Set<Question> questions = new HashSet<>();

    @OneToMany(
            mappedBy = "exam",
            cascade = CascadeType.ALL
    )
    @OrderBy("versionNumber ASC")
    private List<ExamQuestionPoolVersion> questionPoolVersions =
            new ArrayList<>();
}
