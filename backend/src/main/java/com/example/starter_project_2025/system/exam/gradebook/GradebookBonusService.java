package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.exam.gradebook.GradebookDTOs.BonusLog;
import com.example.starter_project_2025.system.exam.gradebook.GradebookDTOs.BonusRequest;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Diem bonus cho sinh vien. Quy tac chong gian lan: moi lan cong deu co ly do bat buoc va nguoi cong,
 * khong tu cong cho chinh minh, moi lan toi da +1, tong bonus con hieu luc cua mot sinh vien trong
 * mot course toi da +1, chi cong khi sinh vien da co diem goc, chi them / thu hoi (khong sua hay xoa).
 */
@Service
@RequiredArgsConstructor
public class GradebookBonusService {

    public static final BigDecimal MAX_PER_STUDENT = BigDecimal.ONE;
    private static final BigDecimal MIN_POINTS = new BigDecimal("0.05");

    private final GradebookService gradebookService;
    private final GradebookBonusRepository bonusRepository;
    private final GradebookColumnRepository columnRepository;
    private final GradebookScoreRepository scoreRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public List<BonusLog> log(Long courseId, UserPrincipal principal) {
        gradebookService.checkCourse(courseId, principal);
        return bonusRepository.findAllByCourse(courseId).stream().map(this::toLog).toList();
    }

    @Transactional
    public List<BonusLog> add(Long courseId, BonusRequest req, UserPrincipal principal) {
        Course course = gradebookService.checkCourse(courseId, principal);
        if (req == null || req.columnId() == null || req.studentId() == null || req.points() == null) {
            throw new BadRequestException("Column, student and points are required");
        }
        String reason = req.reason() == null ? "" : req.reason().trim();
        if (reason.length() < 5) {
            throw new BadRequestException("A reason of at least 5 characters is required");
        }
        BigDecimal points = req.points().setScale(2, RoundingMode.HALF_UP);
        if (points.compareTo(MIN_POINTS) < 0 || points.compareTo(MAX_PER_STUDENT) > 0) {
            throw new BadRequestException("Bonus must be between 0.05 and " + MAX_PER_STUDENT + " points");
        }
        Long actorId = principal.getUser().getId();
        if (actorId.equals(req.studentId())) {
            throw new BadRequestException("You cannot give bonus points to yourself");
        }
        GradebookColumn column = columnRepository.findById(req.columnId())
                .orElseThrow(() -> new ResourceNotFoundException("Column not found"));
        if (!column.getCourse().getId().equals(courseId)) {
            throw new BadRequestException("Column does not belong to this course");
        }
        // enrolled students and extra students (not enrolled, but with an imported score) may get bonus;
        // the "has a score in this column" check below keeps arbitrary users out.
        if (scoreRepository.findByColumn_IdAndStudent_Id(column.getId(), req.studentId())
                .map(GradebookScore::getScore).isEmpty()) {
            throw new BadRequestException("This student has no score in the selected column yet");
        }
        BigDecimal already = bonusRepository.findActiveByCourse(courseId).stream()
                .filter(b -> b.getStudent().getId().equals(req.studentId()))
                .map(GradebookBonus::getPoints).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (already.add(points).compareTo(MAX_PER_STUDENT) > 0) {
            throw new BadRequestException("Total bonus per student in a course is capped at " + MAX_PER_STUDENT
                    + " (already " + already.stripTrailingZeros().toPlainString() + ")");
        }
        bonusRepository.save(GradebookBonus.builder().course(course).column(column)
                .student(em.getReference(User.class, req.studentId())).points(points).reason(reason)
                .grantedBy(actorId).grantedByName(principal.getUser().getFullName()).build());
        return log(courseId, principal);
    }

    @Transactional
    public List<BonusLog> revoke(Long bonusId, UserPrincipal principal) {
        GradebookBonus b = bonusRepository.findById(bonusId)
                .orElseThrow(() -> new ResourceNotFoundException("Bonus not found"));
        Long courseId = b.getCourse().getId();
        gradebookService.checkCourse(courseId, principal);
        if (b.getRevokedAt() == null) {
            b.setRevokedAt(LocalDateTime.now());
            b.setRevokedByName(principal.getUser().getFullName());
        }
        return log(courseId, principal);
    }

    private BonusLog toLog(GradebookBonus b) {
        return new BonusLog(b.getId(), b.getColumn().getId(), b.getColumn().getName(), b.getStudent().getId(),
                b.getStudent().getFullName(), b.getPoints(), b.getReason(), b.getGrantedByName(), b.getCreatedAt(),
                b.getRevokedAt(), b.getRevokedByName());
    }
}
