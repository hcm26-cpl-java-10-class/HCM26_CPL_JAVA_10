package com.example.starter_project_2025.system.demo.report;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import com.example.starter_project_2025.system.demo.certificate.*;
import com.example.starter_project_2025.system.demo.qna.*;
import com.example.starter_project_2025.system.demo.lessonreport.*;
import com.example.starter_project_2025.system.demo.enrollment.*;
import java.util.*;
@RestController @RequestMapping("/api/course-resources") @RequiredArgsConstructor
@PreAuthorize("hasAuthority('ADMIN_ACCESS') and hasAuthority('COURSE_READ')")
public class CourseResourcesController {
 private final CertificateRepository certificates; private final LessonQuestionRepository questions; private final LessonReportRepository reports; private final CourseEnrollmentRepository enrollments;
 @GetMapping("/{kind}") @Transactional(readOnly=true)
 public List<Map<String,Object>> list(@PathVariable String kind) {
  List<Map<String,Object>> rows=new ArrayList<>();
  switch(kind) {
   case "certificates": for(var c:certificates.findAll()) rows.add(row(c.getId(),c.getCourse().getName(),c.getUser().getFullName(),c.getIssuedAt(),c.getVerificationToken()));break;
   case "unanswered-questions":for(var q:questions.findAll()) if(q.getAcceptedAnswerId()==null)rows.add(row(q.getId(),q.getLesson().getTitle(),q.getAuthor().getFullName(),q.getCreatedAt(),q.getContent()));break;
   case "lesson-reports":for(var r:reports.findAll())rows.add(row(r.getId(),r.getLesson().getTitle(),r.getReporter().getFullName(),r.getCreatedAt(),r.getReason()+": "+r.getDetail()+" ("+r.getStatus()+")"));break;
   case "enrollment-logs":for(var e:enrollments.findAll())rows.add(row(e.getId(),e.getCourse().getName(),e.getUser().getFullName(),e.getCreatedAt(),Boolean.FALSE.equals(e.getIsActive())?"Inactive enrollment":"Enrolled"));break;
   default:throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
  }return rows;
 }
 private Map<String,Object> row(Object id,Object course,Object user,Object date,Object detail){Map<String,Object> r=new LinkedHashMap<>();r.put("id",id);r.put("course",course);r.put("user",user);r.put("date",date);r.put("detail",detail);return r;}
}
