package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.gradebook.GradebookDTOs.*;
import com.example.starter_project_2025.system.exam.service.ExamAccessGuard;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** Bang diem (gradebook) cua tung course: cot diem, ti trong, nhap tay, lay diem tu bai thi. */
@Service
@RequiredArgsConstructor
public class GradebookService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal TEN = BigDecimal.TEN;

    private final GradebookColumnRepository columnRepository;
    private final GradebookScoreRepository scoreRepository;
    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamAccessGuard accessGuard;
    private final GradebookStateRepository stateRepository;
    private final GradebookPublishedItemRepository publishedRepository;
    private final com.example.starter_project_2025.system.demo.course.CourseAssessmentCompletionService courseCompletion;

    @PersistenceContext
    private EntityManager em;

    // ------------------------------------------------------------------ courses

    @Transactional(readOnly = true)
    public List<CourseItem> listCourses(UserPrincipal principal) {
        List<Course> courses;
        if (accessGuard.isAdmin(principal)) {
            courses = em.createQuery("select c from Course c order by c.name", Course.class).getResultList();
        } else {
            courses = em.createQuery("select c from Course c where c.instructorUser.id = :uid "
                            + "or exists (select e.id from Exam e where e.course.id = c.id and e.createdBy = :uid) "
                            + "order by c.name", Course.class)
                    .setParameter("uid", principal.getUser().getId()).getResultList();
        }
        List<CourseItem> out = new ArrayList<>();
        for (Course c : courses) {
            out.add(new CourseItem(c.getId(), c.getName(),
                    enrollmentRepository.findActiveStudentsByCourse(c.getId()).size(),
                    columnRepository.countByCourse_Id(c.getId())));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public Gradebook getGradebook(Long courseId, UserPrincipal principal) {
        Course course = checkCourse(courseId, principal);
        return buildGradebook(course);
    }

    private static int typeRank(String type) {
        if (type == null) return 4;
        return switch (type) {
            case "QUIZ" -> 0;
            case "ASSIGNMENT" -> 1;
            case "MIDTERM" -> 2;
            case "FINAL_TEST" -> 3;
            default -> 4;
        };
    }

    private static String snapshotKey(Long studentId, int pos, String type, String name, Long examId,
                                      BigDecimal weight, BigDecimal score) {
        return studentId + "|" + pos + "|" + type + "|" + name + "|" + examId + "|"
                + (weight == null ? "" : weight.stripTrailingZeros().toPlainString()) + "|"
                + (score == null ? "" : score.stripTrailingZeros().toPlainString());
    }

    private Gradebook buildGradebook(Course course) {
        // thu tu hien thi: Quiz, Assignment, Midterm, Final test (cung loai theo thu tu tao)
        List<GradebookColumn> columns = new ArrayList<>(columnRepository.findByCourse_IdOrderByPositionAscIdAsc(course.getId()));
        columns.sort(Comparator.comparingInt((GradebookColumn c) -> typeRank(c.getType())));
        Map<Long, Map<Long, BigDecimal>> byStudent = new HashMap<>();
        for (GradebookScore s : scoreRepository.findAllByCourse(course.getId())) {
            if (s.getScore() == null) continue;
            byStudent.computeIfAbsent(s.getStudent().getId(), k -> new HashMap<>())
                    .put(s.getColumn().getId(), s.getScore());
        }
        BigDecimal totalWeight = BigDecimal.ZERO;
        List<ColumnDto> colDtos = new ArrayList<>();
        for (GradebookColumn c : columns) {
            totalWeight = totalWeight.add(c.getWeightPercent());
            Exam e = c.getSourceExam();
            colDtos.add(new ColumnDto(c.getId(), c.getName(), c.getType(), c.getWeightPercent(),
                    e == null ? null : e.getId(), e == null ? null : e.getTitle()));
        }
        List<StudentRow> rows = new ArrayList<>();
        for (CourseEnrollment en : enrollmentRepository.findActiveStudentsByCourse(course.getId())) {
            User u = en.getUser();
            Map<Long, BigDecimal> scores = byStudent.getOrDefault(u.getId(), Map.of());
            BigDecimal sum = BigDecimal.ZERO;
            for (GradebookColumn c : columns) {
                BigDecimal sc = scores.get(c.getId());
                if (sc != null) sum = sum.add(sc.multiply(c.getWeightPercent()));
            }
            BigDecimal finalScore = columns.isEmpty() ? null
                    : sum.divide(HUNDRED, 2, RoundingMode.HALF_UP);
            rows.add(new StudentRow(u.getId(), u.getFullName(), u.getEmail(), u.getUserCode(), scores, finalScore));
        }
        java.time.LocalDateTime savedAt = stateRepository.findByCourse_Id(course.getId())
                .map(GradebookState::getSavedAt).orElse(null);
        // chua luu = bang diem hien tai khac voi ban da Save gan nhat (hoac chua Save lan nao ma da co cot)
        List<GradebookPublishedItem> published = publishedRepository.findByCourse_Id(course.getId());
        boolean unsaved;
        if (published.isEmpty()) {
            unsaved = !colDtos.isEmpty();
        } else {
            Set<String> current = new HashSet<>();
            for (StudentRow s : rows) {
                int pos = 0;
                for (ColumnDto c : colDtos) {
                    current.add(snapshotKey(s.id(), pos++, c.type(), c.name(), c.examId(), c.weightPercent(), s.scores().get(c.id())));
                }
            }
            Set<String> saved = new HashSet<>();
            for (GradebookPublishedItem i : published) {
                saved.add(snapshotKey(i.getStudent().getId(), i.getPosition(), i.getColumnType(), i.getColumnName(),
                        i.getExamId(), i.getWeightPercent(), i.getScore()));
            }
            unsaved = !current.equals(saved);
        }
        return new Gradebook(course.getId(), course.getName(), colDtos, totalWeight, rows, savedAt, unsaved);
    }

    /** Giang vien xac nhan luu bang diem (du lieu van duoc luu ngay khi sua; day la moc xac nhan). */
    @Transactional
    public Gradebook save(Long courseId, UserPrincipal principal) {
        Course course = checkCourse(courseId, principal);
        GradebookState st = stateRepository.findByCourse_Id(courseId)
                .orElseGet(() -> GradebookState.builder().course(course).build());
        st.setSavedAt(java.time.LocalDateTime.now());
        st.setSavedByUser(principal.getUser().getId());
        stateRepository.save(st);
        publish(course);
        return buildGradebook(course);
    }

    /** Chup bang diem hien tai thanh ban "da luu" de trang My Scores cua sinh vien doc. */
    private void publish(Course course) {
        publishedRepository.deleteByCourse(course.getId());
        publishedRepository.flush();
        Gradebook g = buildGradebook(course);
        List<GradebookPublishedItem> items = new ArrayList<>();
        for (StudentRow s : g.students()) {
            int pos = 0;
            for (ColumnDto c : g.columns()) {
                items.add(GradebookPublishedItem.builder()
                        .course(course)
                        .student(em.getReference(User.class, s.id()))
                        .position(pos++)
                        .columnType(c.type())
                        .columnName(c.name())
                        .examId(c.examId())
                        .examTitle(c.examTitle())
                        .weightPercent(c.weightPercent())
                        .score(s.scores().get(c.id()))
                        .build());
            }
        }
        publishedRepository.saveAll(items);
        courseCompletion.refreshCourse(course.getId());
    }

    /**
     * Quet bai thi dang hoat dong gan voi course: bai nao chua co cot thi tao cot (loai theo category cua bai thi)
     * va lay diem; cot da co bai thi thi chi cap nhat lai diem. Bang diem rong -> ti trong mac dinh theo loai
     * (Assignment 20, Quiz 10, Midterm 30, Final 40, quy ve tong 100); bang diem da co cot -> cot moi 0%.
     */
    @Transactional
    public ScanResult autoScan(Long courseId, UserPrincipal principal) {
        Course course = checkCourse(courseId, principal);
        List<GradebookColumn> existing = columnRepository.findByCourse_IdOrderByPositionAscIdAsc(courseId);
        boolean fresh = existing.isEmpty();
        Set<Long> linked = new HashSet<>();
        for (GradebookColumn c : existing) if (c.getSourceExam() != null) linked.add(c.getSourceExam().getId());

        List<com.example.starter_project_2025.system.exam.domain.ExamCategory> order = List.of(
                com.example.starter_project_2025.system.exam.domain.ExamCategory.ASSIGNMENT,
                com.example.starter_project_2025.system.exam.domain.ExamCategory.QUIZ,
                com.example.starter_project_2025.system.exam.domain.ExamCategory.MIDTERM,
                com.example.starter_project_2025.system.exam.domain.ExamCategory.FINAL_TEST);
        List<Exam> exams = new ArrayList<>(examRepository.findByCourseLink(courseId, null, null, true));
        exams.sort(Comparator.comparingInt((Exam e) -> order.indexOf(e.getCategory())).thenComparing(Exam::getId));
        List<Exam> toCreate = new ArrayList<>();
        for (Exam e : exams) {
            if (e.getCategory() != null && !linked.contains(e.getId())) toCreate.add(e);
        }

        // ti trong mac dinh khi bang diem rong
        Map<String, BigDecimal> weightOf = new HashMap<>();
        if (fresh && !toCreate.isEmpty()) {
            Map<String, BigDecimal> base = Map.of("ASSIGNMENT", BigDecimal.valueOf(20), "QUIZ", BigDecimal.TEN,
                    "MIDTERM", BigDecimal.valueOf(30), "FINAL_TEST", BigDecimal.valueOf(40));
            Map<String, Integer> count = new HashMap<>();
            for (Exam e : toCreate) count.merge(e.getCategory().name(), 1, Integer::sum);
            BigDecimal sumBase = count.keySet().stream().map(base::get).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal assigned = BigDecimal.ZERO;
            String lastKey = null;
            for (Exam e : toCreate) {
                String k = e.getCategory().name();
                BigDecimal w = base.get(k).multiply(HUNDRED).divide(sumBase, 8, RoundingMode.HALF_UP)
                        .divide(BigDecimal.valueOf(count.get(k)), 2, RoundingMode.HALF_UP);
                weightOf.put(e.getId().toString(), w);
                assigned = assigned.add(w);
                lastKey = e.getId().toString();
            }
            // lam tron: dua phan du vao cot cuoi de tong dung 100
            weightOf.put(lastKey, weightOf.get(lastKey).add(HUNDRED.subtract(assigned)));
        }

        // Respect explicit course assessment weights when initializing a complete plan.
        if (fresh && !toCreate.isEmpty() && toCreate.stream().allMatch(e->e.getCourseWeight()!=null
                && e.getCourseWeight().signum()>=0 && e.getCourseWeight().compareTo(HUNDRED)<=0)
                && toCreate.stream().map(Exam::getCourseWeight).reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(HUNDRED)==0) {
            for (Exam exam:toCreate) weightOf.put(exam.getId().toString(),exam.getCourseWeight());
        }

        int pos = existing.size();
        List<GradebookColumn> created = new ArrayList<>();
        for (Exam e : toCreate) {
            GradebookColumn c = GradebookColumn.builder()
                    .course(course)
                    .name("-")
                    .type(e.getCategory().name())
                    .weightPercent(weightOf.getOrDefault(e.getId().toString(), BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP))
                    .position(pos++)
                    .sourceExam(e)
                    .build();
            created.add(columnRepository.save(c));
        }
        columnRepository.flush();
        renameColumns(courseId);

        List<ImportReport> reports = new ArrayList<>();
        int refreshed = 0;
        for (GradebookColumn c : existing) {
            if (c.getSourceExam() != null && exams.stream().anyMatch(x -> x.getId().equals(c.getSourceExam().getId()))) {
                reports.add(compute(c, c.getSourceExam(), true, true));
                refreshed++;
            }
        }
        for (GradebookColumn c : created) reports.add(compute(c, c.getSourceExam(), true));
        return new ScanResult(buildGradebook(course), created.size(), refreshed, reports);
    }

    // ------------------------------------------------------------------ columns

    @Transactional
    public Gradebook addColumn(Long courseId, ColumnRequest req, UserPrincipal principal) {
        Course course = checkCourse(courseId, principal);
        validateColumn(req);
        GradebookColumn c = GradebookColumn.builder()
                .course(course)
                .name("-")
                .type(normalizeType(req.type(), true))
                .weightPercent(req.weightPercent().setScale(2, RoundingMode.HALF_UP))
                .position(columnRepository.countByCourse_Id(courseId))
                .build();
        columnRepository.save(c);
        renameColumns(courseId);
        return buildGradebook(course);
    }

    @Transactional
    public Gradebook updateColumn(Long columnId, ColumnRequest req, UserPrincipal principal) {
        GradebookColumn c = column(columnId);
        checkCourse(c.getCourse().getId(), principal);
        validateColumn(req);
        String type = normalizeType(req.type(), false);
        if (type != null) c.setType(type);
        c.setWeightPercent(req.weightPercent().setScale(2, RoundingMode.HALF_UP));
        columnRepository.save(c);
        columnRepository.flush();
        renameColumns(c.getCourse().getId());
        return buildGradebook(c.getCourse());
    }

    @Transactional
    public Gradebook deleteColumn(Long columnId, UserPrincipal principal) {
        GradebookColumn c = column(columnId);
        Course course = checkCourse(c.getCourse().getId(), principal);
        scoreRepository.deleteByColumn(columnId);
        columnRepository.delete(c);
        columnRepository.flush();
        renameColumns(course.getId());
        return buildGradebook(course);
    }

    private static final Set<String> TYPES = Set.of("ASSIGNMENT", "QUIZ", "MIDTERM", "FINAL_TEST");

    private String normalizeType(String type, boolean required) {
        if (type == null || type.isBlank()) {
            if (required) throw new BadRequestException("Select a score column type (Assignment, Quiz, Midterm or Final)");
            return null;
        }
        String t = type.trim().toUpperCase();
        if (!TYPES.contains(t)) throw new BadRequestException("Unknown score column type: " + type);
        return t;
    }

    /** Ten cot tu dong theo loai: chi 1 cot thi "Quiz", nhieu cot cung loai thi "Quiz 1", "Quiz 2"... */
    private void renameColumns(Long courseId) {
        List<GradebookColumn> cols = columnRepository.findByCourse_IdOrderByPositionAscIdAsc(courseId);
        Map<String, Integer> total = new HashMap<>();
        for (GradebookColumn c : cols) if (c.getType() != null) total.merge(c.getType(), 1, Integer::sum);
        Map<String, Integer> seen = new HashMap<>();
        for (GradebookColumn c : cols) {
            if (c.getType() == null) continue;
            String label = typeLabel(c.getType());
            int n = seen.merge(c.getType(), 1, Integer::sum);
            c.setName(total.get(c.getType()) > 1 ? label + " " + n : label);
        }
        columnRepository.saveAll(cols);
    }

    private static String typeLabel(String type) {
        return switch (type) {
            case "ASSIGNMENT" -> "Assignment";
            case "QUIZ" -> "Quiz";
            case "MIDTERM" -> "Midterm";
            case "FINAL_TEST" -> "Final";
            default -> type;
        };
    }

    private void validateColumn(ColumnRequest req) {
        if (req == null) throw new BadRequestException("Invalid request");
        if (req.weightPercent() == null || req.weightPercent().signum() < 0
                || req.weightPercent().compareTo(HUNDRED) > 0) {
            throw new BadRequestException("Weight must be between 0 and 100 (%)");
        }
    }

    // ------------------------------------------------------------------ cells

    @Transactional
    public Gradebook setCell(Long courseId, CellRequest req, UserPrincipal principal) {
        Course course = checkCourse(courseId, principal);
        GradebookColumn c = column(req.columnId());
        if (!c.getCourse().getId().equals(courseId)) {
            throw new BadRequestException("Column does not belong to this course");
        }
        if (enrollmentRepository.findActiveStudentsByCourse(courseId).stream()
                .noneMatch(e -> e.getUser().getId().equals(req.studentId()))) {
            throw new BadRequestException("Student is not enrolled in this course");
        }
        if (req.score() != null && (req.score().signum() < 0 || req.score().compareTo(TEN) > 0)) {
            throw new BadRequestException("Score must be between 0 and 10");
        }
        Optional<GradebookScore> existing = scoreRepository.findByColumn_IdAndStudent_Id(c.getId(), req.studentId());
        if (req.score() == null) {
            existing.ifPresent(scoreRepository::delete);
        } else {
            GradebookScore s = existing.orElseGet(() -> GradebookScore.builder()
                    .column(c).student(em.getReference(User.class, req.studentId())).build());
            s.setScore(req.score().setScale(2, RoundingMode.HALF_UP));
            s.setSource("MANUAL");
            scoreRepository.save(s);
        }
        return buildGradebook(course);
    }

    // ------------------------------------------------------------------ exams / import

    @Transactional(readOnly = true)
    public List<AvailableExam> availableExams(Long courseId, String type, UserPrincipal principal) {
        checkCourse(courseId, principal);
        Long uid = principal.getUser().getId();
        String cat = normalizeType(type, false);
        var query = em.createQuery("select e from Exam e left join fetch e.course "
                + "where (e.course.id = :cid or e.createdBy = :uid)"
                + (cat != null ? " and e.category = :cat" : "") + " order by e.id desc", Exam.class)
                .setParameter("cid", courseId).setParameter("uid", uid);
        if (cat != null) query.setParameter("cat", com.example.starter_project_2025.system.exam.domain.ExamCategory.valueOf(cat));
        List<Exam> exams = query.getResultList();
        List<AvailableExam> out = new ArrayList<>();
        for (Exam e : exams) {
            boolean inCourse = e.getCourse() != null && e.getCourse().getId().equals(courseId);
            out.add(new AvailableExam(e.getId(), e.getTitle(),
                    e.getCourse() == null ? null : e.getCourse().getName(), inCourse,
                    attemptRepository.findAllByExam_Id(e.getId()).size()));
        }
        // bai thi cua course len truoc
        out.sort(Comparator.comparing((AvailableExam a) -> !a.inCourse()));
        return out;
    }

    @Transactional
    public ImportReport importExam(Long columnId, ImportRequest req, UserPrincipal principal) {
        GradebookColumn c = column(columnId);
        checkCourse(c.getCourse().getId(), principal);
        if (req == null || req.examId() == null) {
            throw new BadRequestException("Select an assessment to import");
        }
        Exam exam = examRepository.findById(req.examId())
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));
        checkExamUsable(exam, c.getCourse().getId(), principal);
        c.setSourceExam(exam);
        columnRepository.save(c);
        return compute(c, exam, true);
    }

    @Transactional(readOnly = true)
    public ImportReport report(Long columnId, UserPrincipal principal) {
        GradebookColumn c = column(columnId);
        checkCourse(c.getCourse().getId(), principal);
        if (c.getSourceExam() == null) {
            throw new BadRequestException("This column has no assessment linked yet");
        }
        return compute(c, c.getSourceExam(), false);
    }

    /** So khop theo user id: co diem + co trong lop -> add; co diem nhung khong trong lop -> thua; trong lop khong co diem -> thieu. */
    private ImportReport compute(GradebookColumn c, Exam exam, boolean apply) {
        return compute(c, exam, apply, false);
    }

    /** keepManual = khong ghi de o diem giang vien da nhap tay (dung khi Scan lam moi cot co san). */
    private ImportReport compute(GradebookColumn c, Exam exam, boolean apply, boolean keepManual) {
        Map<Long, User> enrolled = new LinkedHashMap<>();
        for (CourseEnrollment en : enrollmentRepository.findActiveStudentsByCourse(c.getCourse().getId())) {
            enrolled.put(en.getUser().getId(), en.getUser());
        }
        // diem cao nhat cua moi nguoi (quy ve thang 10)
        Map<Long, BigDecimal> best = new LinkedHashMap<>();
        Map<Long, User> examUsers = new HashMap<>();
        for (ExamAttempt a : attemptRepository.findAllByExam_Id(exam.getId())) {
            if (a.getFinalScore() == null || a.getStudent() == null) continue;
            BigDecimal max = a.getMaxScore() != null && a.getMaxScore().signum() > 0 ? a.getMaxScore()
                    : (exam.getMaxScore() != null && exam.getMaxScore().signum() > 0 ? exam.getMaxScore() : TEN);
            BigDecimal s10 = a.getFinalScore().multiply(TEN).divide(max, 2, RoundingMode.HALF_UP);
            Long sid = a.getStudent().getId();
            examUsers.put(sid, a.getStudent());
            best.merge(sid, s10, BigDecimal::max);
        }
        if (apply) {
            for (GradebookScore s : scoreRepository.findAllByCourse(c.getCourse().getId())) {
                if (s.getColumn().getId().equals(c.getId()) && "EXAM".equals(s.getSource())) {
                    scoreRepository.delete(s);   // bo diem cu lay tu bai thi truoc do
                }
            }
            scoreRepository.flush();
        }
        int imported = 0;
        List<PersonItem> extra = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> e : best.entrySet()) {
            User u = enrolled.get(e.getKey());
            if (u == null) {
                User x = examUsers.get(e.getKey());
                extra.add(person(x, e.getValue(), "Took the assessment but is not enrolled in this course"));
                continue;
            }
            imported++;
            if (apply) {
                GradebookScore s = scoreRepository.findByColumn_IdAndStudent_Id(c.getId(), u.getId())
                        .orElseGet(() -> GradebookScore.builder().column(c).student(u).build());
                if (keepManual && "MANUAL".equals(s.getSource())) {
                    continue;   // giu diem nhap tay
                }
                s.setScore(e.getValue());
                s.setSource("EXAM");
                scoreRepository.save(s);
            }
        }
        List<PersonItem> missing = new ArrayList<>();
        for (User u : enrolled.values()) {
            if (!best.containsKey(u.getId())) {
                missing.add(person(u, null, "Enrolled but has no score in this assessment"));
            }
        }
        return new ImportReport(c.getId(), c.getName(), exam.getId(), exam.getTitle(), imported, extra, missing);
    }

    private PersonItem person(User u, BigDecimal score, String reason) {
        return new PersonItem(u.getId(), u.getFullName(), u.getEmail(), u.getUserCode(), score, reason);
    }

    // ------------------------------------------------------------------ access

    private GradebookColumn column(Long id) {
        return columnRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Column not found"));
    }

    private Course checkCourse(Long courseId, UserPrincipal principal) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        if (accessGuard.isAdmin(principal)) return course;
        Long uid = principal.getUser().getId();
        boolean owner = course.getInstructorUser() != null && uid.equals(course.getInstructorUser().getId());
        if (!owner) {
            Long n = em.createQuery("select count(e) from Exam e where e.course.id = :cid and e.createdBy = :uid", Long.class)
                    .setParameter("cid", courseId).setParameter("uid", uid).getSingleResult();
            owner = n != null && n > 0;
        }
        if (!owner) throw new BadRequestException("You do not manage this course");
        return course;
    }

    private void checkExamUsable(Exam exam, Long courseId, UserPrincipal principal) {
        if (accessGuard.isAdmin(principal)) return;
        boolean inCourse = exam.getCourse() != null && courseId.equals(exam.getCourse().getId());
        boolean mine = Objects.equals(exam.getCreatedBy(), principal.getUser().getId());
        if (!inCourse && !mine) throw new BadRequestException("You cannot use this assessment");
    }
}
