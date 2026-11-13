package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.service.ExamResultAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.function.Predicate;

/** One calculation used by learner grades, staff results and certificate eligibility. */
@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class CourseAssessmentService {
    private final ExamRepository exams;
    private final ExamAttemptRepository attempts;
    private final ExamResultAccessService access;
    private final LessonRepository lessons;
    private final com.example.starter_project_2025.system.exam.gradebook.GradebookPublishedItemRepository publishedRepository;
    public record Plan(BigDecimal totalWeight,boolean ready,List<String> issues) {}
    public record Grade(BigDecimal overallScore,String status,List<CourseGradeItemDTO> items) {}

    public static Plan plan(List<Exam> exams) {
        List<String> issues=new ArrayList<>();
        BigDecimal total=BigDecimal.ZERO;
        for (Exam exam:exams) {
            BigDecimal weight=exam.getCourseWeight();
            if (weight==null) { issues.add(exam.getTitle()+": set a weight (0 for practice)"); continue; }
            if (weight.signum()<0 || weight.compareTo(BigDecimal.valueOf(100))>0 || weight.stripTrailingZeros().scale()>2)
                issues.add(exam.getTitle()+": invalid weight");
            total=total.add(weight);
            if (weight.signum()>0 && !Boolean.TRUE.equals(exam.getIsActive())) issues.add(exam.getTitle()+": weighted assessment must be active");
            if (weight.signum()>0 && (exam.getQuestions()==null || exam.getQuestions().stream().noneMatch(q->Boolean.TRUE.equals(q.getIsActive()))))
                issues.add(exam.getTitle()+": add active questions");
        }
        if (!exams.isEmpty() && total.compareTo(BigDecimal.valueOf(100))!=0) issues.add("Assessment weights must total 100% (currently "+total+"%)");
        return new Plan(total,issues.isEmpty(),List.copyOf(issues));
    }
    public Plan plan(Long courseId) {
        List<Exam> linked=exams.findByCourseLink(courseId,null,null,false);
        Plan weights=plan(linked);
        List<String> issues=new ArrayList<>(weights.issues());
        for (Lesson lesson:lessons.findByCourseIdOrdered(courseId)) {
            if (activeLesson(lesson) && isAssessment(lesson)
                    && linked.stream().noneMatch(exam->exam.getLesson()!=null && lesson.getId().equals(exam.getLesson().getId()) && matches(lesson,exam)))
                issues.add(lesson.getTitle()+": attach a matching assessment");
        }
        return new Plan(weights.totalWeight(),issues.isEmpty(),List.copyOf(issues));
    }
    public void assertReady(Long courseId) {
        Plan plan=plan(courseId);
        if (!plan.ready()) throw new ResponseStatusException(HttpStatus.CONFLICT,String.join("; ",plan.issues()));
    }
    public Grade grade(Long courseId,Long studentId) {
        var published=publishedRepository.findByCourse_IdAndStudent_IdOrderByPositionAsc(courseId,studentId);
        if (!published.isEmpty()) return calculatePublished(published);
        return calculate(exams.findByCourseLink(courseId,null,null,false),
                best(attempts.findAllByStudent_IdOrderByStartedAtDesc(studentId)),access::canStudentSeeScoreOnMyScores);
    }
    public boolean canComplete(Long courseId,Long studentId) {
        Grade grade=grade(courseId,studentId);
        return ("NO_ASSESSMENTS".equals(grade.status()) || "PASSED".equals(grade.status())) && plan(courseId).ready();
    }
    public boolean lessonFinished(Lesson lesson,Long studentId) {
        List<Exam> linked=exams.findByCourseLink(lesson.getSection().getCourse().getId(),null,lesson.getId(),true);
        Map<Long,ExamAttempt> best=best(attempts.findAllByStudent_IdOrderByStartedAtDesc(studentId));
        var published=publishedRepository.findByCourse_IdAndStudent_IdOrderByPositionAsc(lesson.getSection().getCourse().getId(),studentId);
        return !linked.isEmpty() && linked.stream().allMatch(exam->matches(lesson,exam) &&
                (published.stream().anyMatch(item->exam.getId().equals(item.getExamId()) && item.getScore()!=null)
                || best.containsKey(exam.getId()) && access.canStudentSeeScoreOnMyScores(exam)));
    }
    public static boolean activeLesson(Lesson lesson) {
        return !Boolean.FALSE.equals(lesson.getIsActive()) && lesson.getSection()!=null && !Boolean.FALSE.equals(lesson.getSection().getIsActive());
    }
    public static boolean isAssessment(Lesson lesson) {
        return lesson.getContentType()!=null && switch(lesson.getContentType()) { case QUIZ,EXAM,ASSIGNMENT -> true; default -> false; };
    }
    public static boolean matches(Lesson lesson,Exam exam) {
        return lesson.getContentType()!=null && switch(lesson.getContentType()) {
            case QUIZ -> exam.getCategory()==ExamCategory.QUIZ;
            case ASSIGNMENT -> exam.getCategory()==ExamCategory.ASSIGNMENT;
            case EXAM -> exam.getCategory()==ExamCategory.MIDTERM || exam.getCategory()==ExamCategory.FINAL_TEST;
            default -> true;
        };
    }
    public static boolean fullyGraded(ExamAttempt attempt) {
        return attempt!=null && attempt.getFinalScore()!=null && attempt.getSubmittedAt()!=null
                && (attempt.getStatus()==ExamAttemptStatus.SUBMITTED || attempt.getStatus()==ExamAttemptStatus.EXPIRED);
    }
    public static BigDecimal normalized(ExamAttempt attempt) {
        BigDecimal max=attempt.getMaxScore()!=null && attempt.getMaxScore().signum()>0 ? attempt.getMaxScore() :
                attempt.getExam().getMaxScore()!=null && attempt.getExam().getMaxScore().signum()>0 ? attempt.getExam().getMaxScore() : BigDecimal.TEN;
        return attempt.getFinalScore().multiply(BigDecimal.TEN).divide(max,10,RoundingMode.HALF_UP).max(BigDecimal.ZERO).min(BigDecimal.TEN);
    }
    public static Map<Long,ExamAttempt> best(List<ExamAttempt> attempts) {
        Map<Long,ExamAttempt> best=new HashMap<>();
        for (ExamAttempt attempt:attempts) if (fullyGraded(attempt) && attempt.getExam()!=null && attempt.getExam().getId()!=null)
            best.merge(attempt.getExam().getId(),attempt,(a,b)->normalized(a).compareTo(normalized(b))>=0?a:b);
        return best;
    }
    public static Grade calculate(List<Exam> exams,Map<Long,ExamAttempt> best,Predicate<Exam> visible) {
        List<CourseGradeItemDTO> items=new ArrayList<>();
        BigDecimal weighted=BigDecimal.ZERO;
        boolean missing=false,hidden=false;
        for (Exam exam:exams) {
            ExamAttempt attempt=best.get(exam.getId());
            boolean published=visible.test(exam);
            BigDecimal score=fullyGraded(attempt) && published ? normalized(attempt) : null;
            items.add(new CourseGradeItemDTO(label(exam.getCategory()),exam.getId(),exam.getTitle(),exam.getCourseWeight(),
                    score==null?null:score.setScale(2,RoundingMode.HALF_UP)));
            if (exam.getCourseWeight()!=null && exam.getCourseWeight().signum()>0) {
                if (!fullyGraded(attempt)) missing=true;
                else if (!published) hidden=true;
                else weighted=weighted.add(normalized(attempt).multiply(exam.getCourseWeight()));
            }
        }
        if (exams.isEmpty()) return new Grade(null,"NO_ASSESSMENTS",items);
        if (!plan(exams).ready()) return new Grade(null,"PLAN_INCOMPLETE",items);
        if (missing) return new Grade(null,"IN_PROGRESS",items);
        if (hidden) return new Grade(null,"AWAITING_RESULTS",items);
        BigDecimal raw=weighted.divide(BigDecimal.valueOf(100),10,RoundingMode.HALF_UP);
        BigDecimal finalGrade=raw.setScale(2,RoundingMode.HALF_UP);
        return new Grade(finalGrade,finalGrade.compareTo(BigDecimal.valueOf(5))>=0?"PASSED":"FAILED",items);
    }
    /** Score Management's explicitly saved snapshot remains the authoritative published gradebook. */
    public static Grade calculatePublished(java.util.List<com.example.starter_project_2025.system.exam.gradebook.GradebookPublishedItem> published) {
        List<CourseGradeItemDTO> items=new ArrayList<>();
        BigDecimal total=BigDecimal.ZERO,weighted=BigDecimal.ZERO;
        boolean missing=false,invalid=false;
        for (var item:published) {
            String category=item.getColumnType()==null?"Other":switch(item.getColumnType()) {
                case "QUIZ" -> "Quiz"; case "ASSIGNMENT" -> "Assignment"; case "MIDTERM" -> "Midterm"; case "FINAL_TEST" -> "Final"; default -> item.getColumnType();
            };
            String title=item.getExamTitle()==null?item.getColumnName():item.getColumnName()+" ("+item.getExamTitle()+")";
            items.add(new CourseGradeItemDTO(category,item.getExamId(),title,item.getWeightPercent(),item.getScore()));
            BigDecimal weight=item.getWeightPercent();
            if (weight==null || weight.signum()<0 || weight.compareTo(BigDecimal.valueOf(100))>0) {invalid=true;continue;}
            total=total.add(weight);
            if (weight.signum()>0 && item.getScore()==null) missing=true;
            else if (item.getScore()!=null) weighted=weighted.add(item.getScore().multiply(weight));
        }
        if (invalid || total.compareTo(BigDecimal.valueOf(100))!=0) return new Grade(null,"PLAN_INCOMPLETE",items);
        if (missing) return new Grade(null,"IN_PROGRESS",items);
        BigDecimal overall=weighted.divide(BigDecimal.valueOf(100),2,RoundingMode.HALF_UP);
        return new Grade(overall,overall.compareTo(BigDecimal.valueOf(5))>=0?"PASSED":"FAILED",items);
    }

    private static String label(ExamCategory category) {
        if (category==null) return "Assessment";
        return switch(category) { case QUIZ -> "Quiz"; case ASSIGNMENT -> "Assignment"; case MIDTERM -> "Midterm"; case FINAL_TEST -> "Final"; };
    }
}
