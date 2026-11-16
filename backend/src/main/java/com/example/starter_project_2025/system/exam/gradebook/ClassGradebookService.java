package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.gradebook.GradebookDTOs.*;
import com.example.starter_project_2025.system.exam.service.ExamAccessGuard;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.training.ClassEnrollment;
import com.example.starter_project_2025.system.training.ClassEnrollmentRepository;
import com.example.starter_project_2025.system.training.TrainingClassRepository;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Score Management - tab Class: tong hop diem cua hoc vien trong lop (module
 * Training Operations).
 *
 * Hoc vien cua lop (ClassEnrollment) duoc noi sang tai khoan User qua email ca
 * nhan - giong cach moi thi theo lop
 * (InvitationService.resolveOrProvisionTraineeUser) - nhung khong tao tai khoan
 * moi. Diem cua moi user gom:
 * - diem trong bang diem cac course (GradebookScore, theo loai cot
 * Quiz/Assignment/Midterm/Final), va
 * - diem cao nhat cac bai thi da cham (ExamAttempt, quy ve thang 10) chua nam
 * trong bang diem do.
 * Moi cot cua bang lop = 1 loai; o = trung binh cac diem cung loai; cot cuoi =
 * trung binh cac loai co diem.
 */
@Service
@RequiredArgsConstructor
public class ClassGradebookService {

    private static final BigDecimal TEN = BigDecimal.TEN;

    /** Thu tu hien thi giong bang diem cua course. */
    private static final List<ExamCategory> ORDER = List.of(
            ExamCategory.QUIZ, ExamCategory.ASSIGNMENT, ExamCategory.MIDTERM, ExamCategory.FINAL_TEST);

    private final GradebookService gradebookService;
    private final TrainingClassRepository classRepository;
    private final ClassEnrollmentRepository enrollmentRepository;
    private final ExamAccessGuard accessGuard;

    @PersistenceContext
    private EntityManager em;

    /**
     * Mot diem (thang 10) cua 1 user, thuoc 1 loai, kem ten nguon (ten bai thi /
     * course).
     */
    private record Entry(Long userId, String type, BigDecimal score, String source, Long sourceKey) {
    }

    /** Hoc vien cua lop + user da khop (co the null neu chua co tai khoan). */
    private record Member(ClassEnrollment enrollment, User user) {
    }

    // ------------------------------------------------------------------ list

    @Transactional(readOnly = true)
    public List<ClassItem> listClasses(UserPrincipal principal) {
        boolean admin = accessGuard.isAdmin(principal);
        Scope scope = scope(principal, admin);

        List<ClassItem> out = new ArrayList<>();
        List<TrainingClass> classes = classRepository.findAll().stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .sorted(Comparator.comparing(TrainingClass::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        for (TrainingClass c : classes) {
            List<Member> members = members(c.getId());
            List<Entry> entries = entries(members, scope);
            if (!admin && entries.isEmpty() && !isStaffOf(c, principal))
                continue;
            int sources = (int) entries.stream().map(e -> e.type() + "|" + e.sourceKey()).distinct().count();
            out.add(new ClassItem(c.getId(), c.getCode(), c.getName(), members.size(), sources));
        }
        return out;
    }

    // ------------------------------------------------------------------ detail

    @Transactional(readOnly = true)
    public ClassGradebook getClassGradebook(Long classId, UserPrincipal principal) {
        TrainingClass cls = classRepository.findByIdAndIsActiveTrue(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        boolean admin = accessGuard.isAdmin(principal);
        Scope scope = scope(principal, admin);

        List<Member> members = members(classId);
        List<Entry> entries = entries(members, scope);
        if (!admin && entries.isEmpty() && !isStaffOf(cls, principal)) {
            throw new BadRequestException("You do not manage this class");
        }

        // userId -> type -> scores
        Map<Long, Map<String, List<BigDecimal>>> byUser = new HashMap<>();
        Map<String, LinkedHashSet<String>> titlesByType = new HashMap<>();
        Map<String, Set<Long>> sourceKeysByType = new HashMap<>();
        for (Entry e : entries) {
            byUser.computeIfAbsent(e.userId(), k -> new HashMap<>())
                    .computeIfAbsent(e.type(), k -> new ArrayList<>()).add(e.score());
            titlesByType.computeIfAbsent(e.type(), k -> new LinkedHashSet<>()).add(e.source());
            sourceKeysByType.computeIfAbsent(e.type(), k -> new HashSet<>()).add(e.sourceKey());
        }

        List<ClassTypeColumn> columns = new ArrayList<>();
        for (ExamCategory cat : ORDER) {
            String type = cat.name();
            if (!sourceKeysByType.containsKey(type))
                continue;
            int scored = (int) members.stream()
                    .filter(m -> m.user() != null && byUser.getOrDefault(m.user().getId(), Map.of()).containsKey(type))
                    .count();
            columns.add(new ClassTypeColumn(type, label(type), sourceKeysByType.get(type).size(), scored,
                    new ArrayList<>(titlesByType.get(type))));
        }

        Map<String, BigDecimal> columnSums = new HashMap<>();
        Map<String, Integer> columnCounts = new HashMap<>();
        List<ClassStudentRow> rows = new ArrayList<>();
        BigDecimal classSum = BigDecimal.ZERO;
        int classCount = 0;
        for (Member m : members) {
            ClassEnrollment en = m.enrollment();
            Map<String, List<BigDecimal>> perType = m.user() == null ? Map.of()
                    : byUser.getOrDefault(m.user().getId(), Map.of());
            Map<String, BigDecimal> scores = new LinkedHashMap<>();
            int count = 0;
            for (ClassTypeColumn col : columns) {
                List<BigDecimal> list = perType.get(col.type());
                if (list == null || list.isEmpty())
                    continue;
                count += list.size();
                BigDecimal avg = mean(list);
                scores.put(col.type(), avg);
                columnSums.merge(col.type(), avg, BigDecimal::add);
                columnCounts.merge(col.type(), 1, Integer::sum);
            }
            BigDecimal avg = scores.isEmpty() ? null : mean(scores.values());
            if (avg != null) {
                classSum = classSum.add(avg);
                classCount++;
            }
            String name = en.getFullName() != null && !en.getFullName().isBlank() ? en.getFullName()
                    : (m.user() != null ? m.user().getFullName() : "—");
            String email = en.getPersonalEmail() != null && !en.getPersonalEmail().isBlank() ? en.getPersonalEmail()
                    : (m.user() != null ? m.user().getEmail() : null);
            rows.add(new ClassStudentRow(en.getTraineeId(), name, email, en.getStudentId(), scores, avg, count));
        }
        rows.sort(Comparator.comparing(ClassStudentRow::name, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));

        Map<String, BigDecimal> columnAverages = new LinkedHashMap<>();
        for (ClassTypeColumn col : columns) {
            int n = columnCounts.getOrDefault(col.type(), 0);
            columnAverages.put(col.type(), n == 0 ? null
                    : columnSums.get(col.type()).divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP));
        }
        BigDecimal classAverage = classCount == 0 ? null
                : classSum.divide(BigDecimal.valueOf(classCount), 2, RoundingMode.HALF_UP);
        return new ClassGradebook(cls.getId(), cls.getCode(), cls.getName(), columns, rows,
                columnAverages, classAverage);
    }

    // ------------------------------------------------------------------ helpers

    /**
     * Pham vi nhin thay diem: admin = tat ca; giang vien = bai thi do minh tao /
     * course minh quan ly.
     */
    private record Scope(boolean admin, Long uid, Set<Long> courseIds) {
    }

    private Scope scope(UserPrincipal principal, boolean admin) {
        Set<Long> ids = new HashSet<>();
        if (!admin)
            for (Course c : gradebookService.managedCourses(principal))
                ids.add(c.getId());
        return new Scope(admin, principal.getUser().getId(), ids);
    }

    private boolean isStaffOf(TrainingClass c, UserPrincipal principal) {
        User u = principal.getUser();
        for (String s : new String[] { c.getMasterTrainer(), c.getClassAdmin() }) {
            if (s == null || s.isBlank())
                continue;
            if (s.equalsIgnoreCase(u.getEmail()) || s.equalsIgnoreCase(u.getFullName()))
                return true;
        }
        return false;
    }

    /**
     * Hoc vien dang ACTIVE cua lop, noi voi User theo email ca nhan (hoac ma SV
     * + @fpt.edu.vn).
     */
    private List<Member> members(Long classId) {
        List<ClassEnrollment> enrollments = enrollmentRepository
                .findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(classId)
                .stream().filter(e -> e.getStatus() == ClassEnrollment.Status.ACTIVE).toList();
        if (enrollments.isEmpty())
            return List.of();

        Map<ClassEnrollment, String> emailOf = new LinkedHashMap<>();
        Set<String> emails = new HashSet<>();
        for (ClassEnrollment e : enrollments) {
            String email = e.getPersonalEmail() != null && !e.getPersonalEmail().isBlank()
                    ? e.getPersonalEmail().trim().toLowerCase()
                    : (e.getStudentId() != null && !e.getStudentId().isBlank()
                            ? e.getStudentId().trim().toLowerCase() + "@fpt.edu.vn"
                            : null);
            emailOf.put(e, email);
            if (email != null)
                emails.add(email);
        }
        Map<String, User> userByEmail = new HashMap<>();
        if (!emails.isEmpty()) {
            em.createQuery("select u from User u where lower(u.email) in :emails", User.class)
                    .setParameter("emails", emails).getResultList()
                    .forEach(u -> userByEmail.put(u.getEmail().toLowerCase(), u));
        }
        List<Member> out = new ArrayList<>();
        for (ClassEnrollment e : enrollments) {
            String email = emailOf.get(e);
            out.add(new Member(e, email == null ? null : userByEmail.get(email)));
        }
        return out;
    }

    /** Tat ca diem (thang 10) cua cac user trong lop, trong pham vi duoc phep. */
    private List<Entry> entries(List<Member> members, Scope scope) {
        List<Long> userIds = members.stream().filter(m -> m.user() != null).map(m -> m.user().getId()).toList();
        if (userIds.isEmpty())
            return List.of();

        List<Entry> out = new ArrayList<>();
        Map<Long, Set<Long>> linkedExams = new HashMap<>(); // userId -> exam da nam trong bang diem

        // 1) bang diem course
        List<GradebookScore> scores = em.createQuery("select s from GradebookScore s join fetch s.column c "
                + "join fetch c.course left join fetch c.sourceExam "
                + "where s.student.id in :uids and s.score is not null", GradebookScore.class)
                .setParameter("uids", userIds).getResultList();
        for (GradebookScore s : scores) {
            GradebookColumn c = s.getColumn();
            if (c.getType() == null)
                continue;
            if (!scope.admin() && !scope.courseIds().contains(c.getCourse().getId()))
                continue;
            Long uid = s.getStudent().getId();
            if (c.getSourceExam() != null)
                linkedExams.computeIfAbsent(uid, k -> new HashSet<>()).add(c.getSourceExam().getId());
            String src = c.getCourse().getName() + " · " + c.getName();
            out.add(new Entry(uid, c.getType(), s.getScore(), src, -c.getId())); // khoa am = cot bang diem
        }

        // 2) bai thi da cham chua nam trong bang diem
        List<ExamAttempt> attempts = em.createQuery("select a from ExamAttempt a join fetch a.exam e "
                + "left join fetch e.course where a.student.id in :uids and a.finalScore is not null",
                ExamAttempt.class).setParameter("uids", userIds).getResultList();
        Map<String, Entry> best = new LinkedHashMap<>();
        for (ExamAttempt a : attempts) {
            Exam exam = a.getExam();
            if (exam == null || exam.getCategory() == null)
                continue;
            Long uid = a.getStudent().getId();
            if (linkedExams.getOrDefault(uid, Set.of()).contains(exam.getId()))
                continue;
            if (!scope.admin()) {
                boolean mine = Objects.equals(exam.getCreatedBy(), scope.uid())
                        || (exam.getCourse() != null && scope.courseIds().contains(exam.getCourse().getId()));
                if (!mine)
                    continue;
            }
            BigDecimal max = a.getMaxScore() != null && a.getMaxScore().signum() > 0 ? a.getMaxScore()
                    : (exam.getMaxScore() != null && exam.getMaxScore().signum() > 0 ? exam.getMaxScore() : TEN);
            BigDecimal s10 = a.getFinalScore().multiply(TEN).divide(max, 2, RoundingMode.HALF_UP);
            best.merge(exam.getId() + "|" + uid,
                    new Entry(uid, exam.getCategory().name(), s10, exam.getTitle(), exam.getId()),
                    (x, y) -> x.score().compareTo(y.score()) >= 0 ? x : y);
        }
        out.addAll(best.values());
        return out;
    }

    private static BigDecimal mean(Collection<BigDecimal> values) {
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
    }

    private static String label(String type) {
        return switch (type) {
            case "ASSIGNMENT" -> "Assignment";
            case "QUIZ" -> "Quiz";
            case "MIDTERM" -> "Midterm";
            case "FINAL_TEST" -> "Final";
            default -> type;
        };
    }
}
