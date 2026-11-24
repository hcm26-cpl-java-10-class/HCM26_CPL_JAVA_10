package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.core.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.core.service.ExamAccessGuard;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import com.example.starter_project_2025.system.exam.gradebook.GradebookDTOs.*;

/**
 * Score Management - tab Class: tong hop diem cua cac thanh vien trong lop tu
 * cac bai thi (assessment) ho da lam.
 * Lop khong gan truc tiep voi course nen diem lay theo user: diem cao nhat moi
 * bai (quy ve thang 10), roi
 * trung binh theo loai bai (Quiz / Assignment / Midterm / Final), cot cuoi =
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
    private final ClassMemberRepository classMemberRepository;
    private final ExamAccessGuard accessGuard;

    @PersistenceContext
    private EntityManager em;

    /** Diem cao nhat (thang 10) cua 1 user trong 1 bai thi. */
    private record Best(Exam exam, Long studentId, BigDecimal score) {
    }

    // ------------------------------------------------------------------ list

    @Transactional(readOnly = true)
    public List<ClassItem> listClasses(UserPrincipal principal) {
        boolean admin = accessGuard.isAdmin(principal);
        Long uid = principal.getUser().getId();
        Set<Long> managed = admin ? null : managedCourseIds(principal);

        List<ClassItem> out = new ArrayList<>();
        List<TrainingClass> classes = classRepository.findAll().stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .sorted(Comparator.comparing(TrainingClass::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        for (TrainingClass c : classes) {
            List<ClassMember> members = activeMembers(c.getId());
            List<Best> bests = bestScores(members, admin, uid, managed);
            boolean visible = admin || Objects.equals(c.getMentorId(), uid) || !bests.isEmpty();
            if (!visible)
                continue;
            int exams = (int) bests.stream().map(b -> b.exam().getId()).distinct().count();
            out.add(new ClassItem(c.getId(), c.getCode(), c.getName(), members.size(), exams));
        }
        return out;
    }

    // ------------------------------------------------------------------ detail

    @Transactional(readOnly = true)
    public ClassGradebook getClassGradebook(Long classId, UserPrincipal principal) {
        TrainingClass cls = classRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        boolean admin = accessGuard.isAdmin(principal);
        Long uid = principal.getUser().getId();
        Set<Long> managed = admin ? null : managedCourseIds(principal);

        List<ClassMember> members = activeMembers(classId);
        List<Best> bests = bestScores(members, admin, uid, managed);
        if (!admin && bests.isEmpty() && !Objects.equals(cls.getMentorId(), uid)) {
            throw new BadRequestException("You do not manage this class");
        }

        // studentId -> type -> scores of the assessments of that type
        Map<Long, Map<String, List<BigDecimal>>> byStudent = new HashMap<>();
        Map<String, LinkedHashSet<String>> titlesByType = new HashMap<>();
        Map<String, Set<Long>> examIdsByType = new HashMap<>();
        for (Best b : bests) {
            String type = typeOf(b.exam());
            byStudent.computeIfAbsent(b.studentId(), k -> new HashMap<>())
                    .computeIfAbsent(type, k -> new ArrayList<>()).add(b.score());
            titlesByType.computeIfAbsent(type, k -> new LinkedHashSet<>()).add(b.exam().getTitle());
            examIdsByType.computeIfAbsent(type, k -> new HashSet<>()).add(b.exam().getId());
        }

        List<ClassTypeColumn> columns = new ArrayList<>();
        for (ExamCategory cat : ORDER) {
            String type = cat.name();
            if (!examIdsByType.containsKey(type))
                continue;
            int scored = (int) byStudent.values().stream().filter(m -> m.containsKey(type)).count();
            columns.add(new ClassTypeColumn(type, label(type), examIdsByType.get(type).size(), scored,
                    new ArrayList<>(titlesByType.get(type))));
        }

        Map<String, BigDecimal> columnSums = new HashMap<>();
        Map<String, Integer> columnCounts = new HashMap<>();
        List<ClassStudentRow> rows = new ArrayList<>();
        BigDecimal classSum = BigDecimal.ZERO;
        int classCount = 0;
        for (ClassMember m : members) {
            User u = m.getUser();
            Map<String, List<BigDecimal>> perType = byStudent.getOrDefault(u.getId(), Map.of());
            Map<String, BigDecimal> scores = new LinkedHashMap<>();
            int examCount = 0;
            for (ClassTypeColumn col : columns) {
                List<BigDecimal> list = perType.get(col.type());
                if (list == null || list.isEmpty())
                    continue;
                examCount += list.size();
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
            rows.add(new ClassStudentRow(u.getId(), u.getFullName(), u.getEmail(), u.getUserCode(),
                    scores, avg, examCount));
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

    private List<ClassMember> activeMembers(Long classId) {
        return classMemberRepository.findAllByTrainingClass_IdAndStatusOrderByIdAsc(classId, ClassMemberStatus.ACTIVE);
    }

    private Set<Long> managedCourseIds(UserPrincipal principal) {
        Set<Long> ids = new HashSet<>();
        for (Course c : gradebookService.managedCourses(principal))
            ids.add(c.getId());
        return ids;
    }

    /**
     * Diem cao nhat tren moi bai thi cua cac thanh vien (chi bai da co diem). Admin
     * thay het; giang vien chi thay
     * bai do minh tao hoac bai thuoc course minh quan ly.
     */
    private List<Best> bestScores(List<ClassMember> members, boolean admin, Long uid, Set<Long> managedCourses) {
        if (members.isEmpty())
            return List.of();
        List<Long> userIds = members.stream().map(m -> m.getUser().getId()).toList();
        List<ExamAttempt> attempts = em.createQuery("select a from ExamAttempt a join fetch a.exam e "
                + "left join fetch e.course where a.student.id in :uids and a.finalScore is not null",
                ExamAttempt.class).setParameter("uids", userIds).getResultList();

        Map<String, Best> best = new LinkedHashMap<>();
        for (ExamAttempt a : attempts) {
            Exam exam = a.getExam();
            if (exam == null || exam.getCategory() == null)
                continue;
            if (!admin) {
                boolean mine = Objects.equals(exam.getCreatedBy(), uid)
                        || (exam.getCourse() != null && managedCourses.contains(exam.getCourse().getId()));
                if (!mine)
                    continue;
            }
            BigDecimal max = a.getMaxScore() != null && a.getMaxScore().signum() > 0 ? a.getMaxScore()
                    : (exam.getMaxScore() != null && exam.getMaxScore().signum() > 0 ? exam.getMaxScore() : TEN);
            BigDecimal s10 = a.getFinalScore().multiply(TEN).divide(max, 2, RoundingMode.HALF_UP);
            Long sid = a.getStudent().getId();
            best.merge(exam.getId() + "|" + sid, new Best(exam, sid, s10),
                    (x, y) -> x.score().compareTo(y.score()) >= 0 ? x : y);
        }
        return new ArrayList<>(best.values());
    }

    private static BigDecimal mean(Collection<BigDecimal> values) {
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
    }

    private static String typeOf(Exam e) {
        return e.getCategory().name();
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
