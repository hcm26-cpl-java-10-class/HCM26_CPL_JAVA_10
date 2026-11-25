package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Mot lan giang vien cong diem bonus cho sinh vien vao mot cot diem. Chi them hoac thu hoi (revoke),
 * khong sua/xoa: bang nay la nhat ky kiem toan. Diem goc cua bai thi khong bi thay doi.
 */
@Entity
@Table(name = "gradebook_bonus", indexes = @Index(name = "idx_gb_bonus_course", columnList = "course_id, student_id"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class GradebookBonus extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "column_id", nullable = false)
    private GradebookColumn column;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(nullable = false, precision = 4, scale = 2)
    private BigDecimal points;

    @Column(nullable = false, length = 500)
    private String reason;

    @Column(name = "granted_by", nullable = false)
    private Long grantedBy;

    @Column(name = "granted_by_name", length = 255)
    private String grantedByName;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "revoked_by_name", length = 255)
    private String revokedByName;
}
