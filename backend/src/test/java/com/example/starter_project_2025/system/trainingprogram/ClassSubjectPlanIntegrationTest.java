package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Transactional
class ClassSubjectPlanIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    @Autowired
    TrainingProgramRepository programRepository;

    @Autowired
    TrainingProgramService programService;

    @Autowired
    SubjectRepository subjectRepository;

    @Autowired
    CourseRepository courseRepository;

    private String loginAs(String email) throws Exception {
        String response = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return "Bearer " + mapper.readTree(response).get("accessToken").asText();
    }

    @Test
    void setupOverviewAndPlanSummaryReturnContextMissingCountsAndSubjectOptions() throws Exception {
        String adminBearer = loginAs("admin@example.com");

        // 1. Setup overview returns all shared classes with context, enrolledCount, and missing counts
        mvc.perform(get("/api/classes/setup-overview").header("Authorization", adminBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].code").value("LOCAL_JAVA_01"))
                .andExpect(jsonPath("$[0].enrolledCount").value(18))
                .andExpect(jsonPath("$[0].totalSubjects").value(3))
                .andExpect(jsonPath("$[0].coursesAssignedCount").value(1))
                .andExpect(jsonPath("$[0].missingCourseCount").value(2))
                .andExpect(jsonPath("$[0].missingTrainerCount").value(2))
                .andExpect(jsonPath("$[0].missingScheduleCount").value(2))
                .andExpect(jsonPath("$[0].setupComplete").value(false));

        // 2. Plan summary on Class 1 lists exact missing subjects (DATABASE_SQL & SPRING_BOOT)
        mvc.perform(get("/api/classes/1/plan-summary").header("Authorization", adminBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasProgram").value(true))
                .andExpect(jsonPath("$.enrolledCount").value(18))
                .andExpect(jsonPath("$.missingCourses", hasSize(2)))
                .andExpect(jsonPath("$.missingAssignments", hasSize(2)))
                .andExpect(jsonPath("$.missingSchedules", hasSize(2)))
                .andExpect(jsonPath("$.programChangeBlocked").value(true))
                .andExpect(jsonPath("$.programChangeBlockReasons", hasSize(greaterThanOrEqualTo(3))));

        // 3. Subject options contract exposes programSubjectId, subjectId, orderIndex, durationHours and Course
        mvc.perform(get("/api/classes/1/subject-options").header("Authorization", adminBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].orderIndex").value(1))
                .andExpect(jsonPath("$[0].subjectCode").value("JAVA_CORE"))
                .andExpect(jsonPath("$[0].courseCode").value("CRS-JAVA-101"))
                .andExpect(jsonPath("$[1].orderIndex").value(2))
                .andExpect(jsonPath("$[1].subjectCode").value("DATABASE_SQL"))
                .andExpect(jsonPath("$[1].courseId").isEmpty());
    }

    @Test
    void scr52BlocksChangingOrRemovingExistingCourseAfterEnrollmentButAllowsInitialCourseAssignment() throws Exception {
        String adminBearer = loginAs("admin@example.com");

        String planRaw = mvc.perform(get("/api/classes/1/program-subjects").header("Authorization", adminBearer))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode plan = mapper.readTree(planRaw);
        long javaCorePsId = plan.get("subjects").get(0).get("programSubjectId").asLong();
        long sqlPsId = plan.get("subjects").get(1).get("programSubjectId").asLong();

        Course altJavaCourse = courseRepository.findByCode("CRS-JAVA-102").orElseThrow();
        Course sqlCourse = courseRepository.findByCode("CRS-SQL-101").orElseThrow();

        // Class 1 has enrolledCount = 18 and JAVA_CORE already has CRS-JAVA-101 -> changing to CRS-JAVA-102 must return 409
        mvc.perform(put("/api/classes/1/program-subjects/{psId}/course", javaCorePsId)
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"courseId\":" + altJavaCourse.getId() + "}"))
                .andExpect(status().isConflict());

        // Unassigning CRS-JAVA-101 on Class 1 must also return 409
        mvc.perform(put("/api/classes/1/program-subjects/{psId}/course", javaCorePsId)
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"courseId\":null}"))
                .andExpect(status().isConflict());

        // DATABASE_SQL does NOT have a course yet -> initial assignment is allowed even with enrolledCount > 0
        mvc.perform(put("/api/classes/1/program-subjects/{psId}/course", sqlPsId)
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"courseId\":" + sqlCourse.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedCount").value(1))
                .andExpect(jsonPath("$.plan.subjects[1].course.code").value("CRS-SQL-101"))
                .andExpect(jsonPath("$.plan.subjects[1].courseChangeLocked").value(true));
    }

    @Test
    void programLifecycleAndTopicCourseValidationWorkOnFreshClassWithoutEnrollments() throws Exception {
        String adminBearer = loginAs("admin@example.com");

        TrainingProgram javaProgram = programRepository.findByCodeAndVersion("LOCAL_JAVA", "1.0").orElseThrow();
        TrainingProgram fullstackProgram = programRepository.findByCodeAndVersion("LOCAL_FULLSTACK", "1.0").orElseThrow();

        // Draft program cannot be assigned -> 400 Bad Request
        long subjectId = subjectRepository.findByCodeAndVersion("JAVA_CORE", "1.0").orElseThrow().getId();
        var draftProgram = programService.create(new TrainingProgramRequest(
                "DRAFT_PRG", "Chương trình nháp", "1.0", "HCM",
                List.of(new ProgramSubjectRequest(subjectId, 1))
        ));
        mvc.perform(put("/api/classes/2/training-program")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"programId\":" + draftProgram.id() + "}"))
                .andExpect(status().isBadRequest());

        // Assign ACTIVE program to Class 2 (enrolledCount == 0)
        String assignedRaw = mvc.perform(put("/api/classes/2/training-program")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"programId\":" + javaProgram.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.program.code").value("LOCAL_JAVA"))
                .andExpect(jsonPath("$.subjects", hasSize(3)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode assignedPlan = mapper.readTree(assignedRaw);
        long javaPsId = assignedPlan.get("subjects").get(0).get("programSubjectId").asLong();

        Course activeJavaCourse1 = courseRepository.findByCode("CRS-JAVA-101").orElseThrow();
        Course activeJavaCourse2 = courseRepository.findByCode("CRS-JAVA-102").orElseThrow();
        Course inactiveJavaCourse = courseRepository.findByCode("CRS-JAVA-OLD").orElseThrow();
        Course wrongTopicSqlCourse = courseRepository.findByCode("CRS-SQL-101").orElseThrow();

        // Reject INACTIVE course -> 400
        mvc.perform(put("/api/classes/2/topic-courses")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"programSubjectId\":" + javaPsId + ",\"courseId\":" + inactiveJavaCourse.getId() + "}]}"))
                .andExpect(status().isBadRequest());

        // Reject Course belonging to wrong Topic -> 400
        mvc.perform(put("/api/classes/2/topic-courses")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"programSubjectId\":" + javaPsId + ",\"courseId\":" + wrongTopicSqlCourse.getId() + "}]}"))
                .andExpect(status().isBadRequest());

        // Link valid ACTIVE Course to Class 2
        mvc.perform(put("/api/classes/2/topic-courses")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"programSubjectId\":" + javaPsId + ",\"courseId\":" + activeJavaCourse1.getId() + "}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedCount").value(1));

        // While Course is linked on Class 2, changing or removing program must be blocked (409)
        mvc.perform(put("/api/classes/2/training-program")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"programId\":" + fullstackProgram.getId() + "}"))
                .andExpect(status().isConflict());

        mvc.perform(delete("/api/classes/2/training-program").header("Authorization", adminBearer))
                .andExpect(status().isConflict());

        // Since Class 2 has enrolledCount == 0, updating Course and then unassigning Course is allowed
        mvc.perform(put("/api/classes/2/topic-courses")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"programSubjectId\":" + javaPsId + ",\"courseId\":" + activeJavaCourse2.getId() + "}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount").value(1));

        mvc.perform(put("/api/classes/2/topic-courses")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"programSubjectId\":" + javaPsId + ",\"courseId\":null}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removedCount").value(1));

        // Now that Class 2 has no linked Course, no enrollment, no assignment, and no session:
        // changing program and removing program both succeed!
        mvc.perform(put("/api/classes/2/training-program")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"programId\":" + fullstackProgram.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.program.code").value("LOCAL_FULLSTACK"))
                .andExpect(jsonPath("$.subjects", hasSize(5)));

        mvc.perform(delete("/api/classes/2/training-program").header("Authorization", adminBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.program").isEmpty())
                .andExpect(jsonPath("$.subjects", hasSize(0)));

        // Class 1 (which has enrollment + Course + assignment + session) blocks destructive program change/removal
        // and preserves existing assignment & session intact
        mvc.perform(delete("/api/classes/1/training-program").header("Authorization", adminBearer))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/classes/1/teaching-assignments").header("Authorization", adminBearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void rbacEnforcesReadForTeacherAndWriteOnlyForAuthorizedRoles() throws Exception {
        String teacherBearer = loginAs("teacher@example.com");
        String studentBearer = loginAs("student@example.com");
        TrainingProgram javaProgram = programRepository.findByCodeAndVersion("LOCAL_JAVA", "1.0").orElseThrow();

        // TEACHER has CLASS_READ -> can read overview, plan, summary, subject-options
        mvc.perform(get("/api/classes/setup-overview").header("Authorization", teacherBearer))
                .andExpect(status().isOk());
        mvc.perform(get("/api/classes/1/program-subjects").header("Authorization", teacherBearer))
                .andExpect(status().isOk());
        mvc.perform(get("/api/classes/1/plan-summary").header("Authorization", teacherBearer))
                .andExpect(status().isOk());
        mvc.perform(get("/api/classes/1/subject-options").header("Authorization", teacherBearer))
                .andExpect(status().isOk());

        // TEACHER lacks CLASS_UPDATE_PROGRAM and CLASS_UPDATE_COURSE -> 403 Forbidden
        mvc.perform(put("/api/classes/2/training-program")
                        .header("Authorization", teacherBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"programId\":" + javaProgram.getId() + "}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/classes/1/topic-courses")
                        .header("Authorization", teacherBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[{\"programSubjectId\":1,\"courseId\":null}]}"))
                .andExpect(status().isForbidden());

        // STUDENT lacks CLASS_READ -> 403 Forbidden
        mvc.perform(get("/api/classes/setup-overview").header("Authorization", studentBearer))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/classes/1/program-subjects").header("Authorization", studentBearer))
                .andExpect(status().isForbidden());
    }

    @Test
    void classCrudAndExcelTemplateDownloadWorkEndToEnd() throws Exception {
        String adminBearer = loginAs("admin@example.com");

        // 1. Download Excel template for class-setup
        mvc.perform(get("/api/import/template").param("entity", "class-setup").header("Authorization", adminBearer))
                .andExpect(status().isOk());

        // 2. Create a new class
        String createdRaw = mvc.perform(post("/api/classes")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "code": "HCM27_JAVA_NEW",
                                  "name": "Lớp Java Khóa Mới",
                                  "startDate": "2027-02-01",
                                  "endDate": "2027-06-30",
                                  "status": "active",
                                  "plannedSize": 28,
                                  "formatType": "Hybrid",
                                  "site": "TP. Hồ Chí Minh",
                                  "location": "F-Town 3, Phòng B202"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("HCM27_JAVA_NEW"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        long createdId = mapper.readTree(createdRaw).get("id").asLong();

        // 3. Update an already-started class (Class 1 has startDate = 2026-10-01) keeping its existing startDate
        mvc.perform(put("/api/classes/1")
                        .header("Authorization", adminBearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "code": "LOCAL_JAVA_01",
                                  "name": "Lớp Java mẫu 01 (Đã cập nhật phòng)",
                                  "startDate": "2026-10-01",
                                  "endDate": "2027-01-31",
                                  "status": "active",
                                  "plannedSize": 26,
                                  "formatType": "Offline",
                                  "site": "TP. Hồ Chí Minh",
                                  "location": "F-Town 3, Phòng A105"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location").value("F-Town 3, Phòng A105"));

        // 4. Delete Class 1 is blocked (409) because it has linked Course, assignment, and session
        mvc.perform(delete("/api/classes/1").header("Authorization", adminBearer))
                .andExpect(status().isConflict());

        // 5. Delete newly created empty class succeeds (204)
        mvc.perform(delete("/api/classes/{id}", createdId).header("Authorization", adminBearer))
                .andExpect(status().isNoContent());
    }
}

