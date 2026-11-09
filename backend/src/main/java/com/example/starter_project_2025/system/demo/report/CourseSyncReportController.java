package com.example.starter_project_2025.system.demo.report;
import com.example.starter_project_2025.system.demo.course.*;
import com.example.starter_project_2025.system.demo.enrollment.*;
import com.example.starter_project_2025.system.demo.progress.*;
import com.example.starter_project_2025.system.demo.certificate.*;
import com.example.starter_project_2025.system.demo.online_lession.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@RestController @RequestMapping("/api/course-enrollments") @RequiredArgsConstructor
public class CourseSyncReportController {
 private final CourseRepository courses; private final CourseEnrollmentRepository enrollments;
 private final LessonRepository lessons; private final LessonProgressRepository progress; private final CertificateRepository certificates;
 @GetMapping @PreAuthorize("hasAuthority('ADMIN_ACCESS') and hasAuthority('COURSE_READ')") @Transactional(readOnly=true)
 public List<Map<String,Object>> report() {
  List<Map<String,Object>> rows=new ArrayList<>();
  for(Course c:courses.findAll()) {
   var lessonIds=lessons.findAllByCourse_IdAndIsActiveTrueOrderByOrderIndexAsc(c.getId()).stream().map(Lesson::getId).collect(java.util.stream.Collectors.toSet());
   List<Map<String,Object>> learners=new ArrayList<>();
   for(CourseEnrollment e:enrollments.findAllByCourse_Id(c.getId())) {
    if(Boolean.FALSE.equals(e.getIsActive())) continue;
    long completed=progress.findAllByEnrollment_Id(e.getId()).stream().filter(p->p.isCompleted() && lessonIds.contains(p.getLesson().getId())).count();
    int percent=lessonIds.isEmpty()?0:(int)Math.round(completed*100.0/lessonIds.size());
    Map<String,Object> l=new LinkedHashMap<>(); l.put("department",e.getUser().getDepartment()); l.put("userId",e.getUser().getId()); l.put("name",e.getUser().getFullName()); l.put("email",e.getUser().getEmail()); l.put("enrolledAt",e.getCreatedAt()); l.put("progress",percent); l.put("completed",!lessonIds.isEmpty()&&percent==100); l.put("active",progress.findAllByEnrollment_Id(e.getId()).stream().anyMatch(p->p.getLastAccessedAt()!=null && p.getLastAccessedAt().isAfter(java.time.LocalDateTime.now().minusDays(30)))); learners.add(l);
   }
   Map<String,Object> r=new LinkedHashMap<>(); r.put("courseId",c.getId());r.put("courseName",c.getName());r.put("instructor",c.getInstructor());r.put("categories",c.getCategories().stream().map(com.example.starter_project_2025.system.demo.category.Category::getName).sorted().toList());r.put("category",c.getCategory());r.put("categoryName",c.getCategoryName());r.put("courseLevel",c.getCourseLevel());r.put("courseStatus",c.getPublicationStatus());r.put("learners",learners);r.put("learnerCount",learners.size());r.put("averageProgress",learners.stream().mapToInt(l->(Integer)l.get("progress")).average().orElse(0));r.put("completedLearners",learners.stream().filter(l->Boolean.TRUE.equals(l.get("completed"))).count());r.put("certificates",certificates.countByCourse_Id(c.getId()));rows.add(r);
  } return rows;
 }
}
