package com.example.starter_project_2025.system.exam.domain;

import java.math.BigDecimal; // NEW
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
        group = "Exam Management",
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

    // Cho phép sinh viên xem lại đáp án đúng sau khi thi (vẫn phải thỏa điều kiện ở ExamResultAccessService)
    @Column(nullable = false)
    private Boolean showAnswersAfterExam = false;

    // CHANGED: điểm đạt giờ tính theo thang điểm của đề (có thể lẻ), trước đây là Integer
    @Column(precision = 8, scale = 2)
    private BigDecimal passScore;

    // NEW: thang điểm tối đa của đề (mặc định 10). Tỉ lệ điểm của từng câu được quy ra theo thang này
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

    // NEW: kiểu bài thi (chỉ trắc nghiệm / chỉ tự luận / cả hai). Đề cũ mặc định MIXED.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ExamType examType = ExamType.MIXED;

    @Column(length = 100)
    private String accessCode;

    @ManyToMany
    @JoinTable(name = "exam_question",
            joinColumns = @JoinColumn(name = "exam_id"),
            inverseJoinColumns = @JoinColumn(name = "question_id"))
    private Set<Question> questions = new HashSet<>();
}
