package com.example.starter_project_2025.controller;

import com.example.starter_project_2025.system.class_setup.*;
import com.example.starter_project_2025.system.class_setup.dto.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;

@ExtendWith(MockitoExtension.class)
class ClassSetupControllerTest {

    private MockMvc mockMvc;

    private ObjectMapper objectMapper;

    @Mock
    private ClassSetupService classSetupService;

    @InjectMocks
    private ClassSetupController classSetupController;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        MappingJackson2HttpMessageConverter converter = new MappingJackson2HttpMessageConverter(objectMapper);

        mockMvc = MockMvcBuilders.standaloneSetup(classSetupController)
                .setMessageConverters(converter)
                .build();
    }

    // =========================================================================
    // 1. PUT /api/classes/{id}/training-program
    // =========================================================================

    @Test
    @DisplayName("PUT /api/classes/{id}/training-program - Gán chương trình thành công")
    void assignTrainingProgram_Success() throws Exception {
        TrainingClassResponse response = new TrainingClassResponse(
                1L, "HCM26_CPL_JAVA_10", "HCM26 Java 10", 10L, "PROG_JAVA", "Java Core", 1,
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31), ClassStatus.IN_PROGRESS, 25,
                true, null, null
        );

        when(classSetupService.assignTrainingProgram(eq(1L), eq(10L))).thenReturn(response);

        AssignProgramRequest request = new AssignProgramRequest(10L);

        mockMvc.perform(put("/api/classes/1/training-program")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.programId").value(10))
                .andExpect(jsonPath("$.code").value("HCM26_CPL_JAVA_10"));
    }

    // =========================================================================
    // 2. GET /api/classes/{id}/program-subjects
    // =========================================================================

    @Test
    @DisplayName("GET /api/classes/{id}/program-subjects - Hiển thị môn học và giảng viên phân công")
    void getClassProgramSubjects_Success() throws Exception {
        ClassProgramSubjectResponse.TrainerAssignmentInfo trainerInfo = new ClassProgramSubjectResponse.TrainerAssignmentInfo(
                501L, 5L, "Nguyễn Văn A", "teacher@example.com", AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 11, 30), true
        );

        ClassProgramSubjectResponse subjectResponse = new ClassProgramSubjectResponse(
                101L, 1L, "JAVA_CORE", "Java Core & OOP Fundamentals", 40, 1,
                List.of(trainerInfo)
        );

        when(classSetupService.getClassProgramSubjects(1L)).thenReturn(List.of(subjectResponse));

        mockMvc.perform(get("/api/classes/1/program-subjects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].programSubjectId").value(101))
                .andExpect(jsonPath("$[0].subjectCode").value("JAVA_CORE"))
                .andExpect(jsonPath("$[0].assignments[0].trainerName").value("Nguyễn Văn A"));
    }

    // =========================================================================
    // 3. POST /api/teaching-assignments
    // =========================================================================

    @Test
    @DisplayName("POST /api/teaching-assignments - Gán giảng viên thành công")
    void createTeachingAssignment_Success() throws Exception {
        TeachingAssignmentRequest request = new TeachingAssignmentRequest(
                1L, 101L, 5L, AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 11, 30)
        );

        TeachingAssignmentResponse response = new TeachingAssignmentResponse(
                501L, 1L, "HCM26_CPL_JAVA_10", 101L, 1L, "JAVA_CORE",
                "Java Core & OOP Fundamentals", 1, 5L, "Nguyễn Văn A",
                "teacher@example.com", AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 11, 30), true
        );

        when(classSetupService.createTeachingAssignment(any(TeachingAssignmentRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/teaching-assignments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(501))
                .andExpect(jsonPath("$.classCode").value("HCM26_CPL_JAVA_10"))
                .andExpect(jsonPath("$.programSubjectId").value(101))
                .andExpect(jsonPath("$.trainerId").value(5))
                .andExpect(jsonPath("$.role").value("MAIN"));
    }

    // =========================================================================
    // 4. PUT /api/teaching-assignments/{id}
    // =========================================================================

    @Test
    @DisplayName("PUT /api/teaching-assignments/{id} - Cập nhật phân công thành công")
    void updateTeachingAssignment_Success() throws Exception {
        UpdateTeachingAssignmentRequest request = new UpdateTeachingAssignmentRequest(
                5L, AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 12, 15)
        );

        TeachingAssignmentResponse response = new TeachingAssignmentResponse(
                501L, 1L, "HCM26_CPL_JAVA_10", 101L, 1L, "JAVA_CORE",
                "Java Core & OOP Fundamentals", 1, 5L, "Nguyễn Văn A",
                "teacher@example.com", AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 12, 15), true
        );

        when(classSetupService.updateTeachingAssignment(eq(501L), any(UpdateTeachingAssignmentRequest.class)))
                .thenReturn(response);

        mockMvc.perform(put("/api/teaching-assignments/501")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effectiveTo").value("2026-12-15"));
    }

    // =========================================================================
    // 5. DELETE /api/teaching-assignments/{id}
    // =========================================================================

    @Test
    @DisplayName("DELETE /api/teaching-assignments/{id} - Hủy phân công thành công")
    void deleteTeachingAssignment_Success() throws Exception {
        mockMvc.perform(delete("/api/teaching-assignments/501"))
                .andExpect(status().isNoContent());

        verify(classSetupService).deleteTeachingAssignment(501L);
    }

    // =========================================================================
    // 6. GET /api/classes/{id}/teaching-assignments/available
    // =========================================================================

    @Test
    @DisplayName("GET /api/classes/{id}/teaching-assignments/available - Lấy phân công khả dụng cho Danh")
    void getAvailableAssignments_Success() throws Exception {
        AvailableAssignmentResponse available = new AvailableAssignmentResponse(
                501L, 1L, "HCM26_CPL_JAVA_10", 101L, 1L, "JAVA_CORE",
                "Java Core & OOP Fundamentals", 1, 5L, "Nguyễn Văn A",
                "teacher@example.com", AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 11, 30)
        );

        when(classSetupService.getAvailableAssignments(eq(1L), any())).thenReturn(List.of(available));

        mockMvc.perform(get("/api/classes/1/teaching-assignments/available")
                        .param("date", "2026-10-25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].assignmentId").value(501))
                .andExpect(jsonPath("$[0].subjectCode").value("JAVA_CORE"))
                .andExpect(jsonPath("$[0].trainerName").value("Nguyễn Văn A"));
    }

    // =========================================================================
    // 7. GET /api/teaching-assignments?trainerId=5
    // =========================================================================

    @Test
    @DisplayName("GET /api/teaching-assignments?trainerId=5 - Lấy lịch cho Tân")
    void getAssignmentsByTrainer_Success() throws Exception {
        TeachingAssignmentResponse response = new TeachingAssignmentResponse(
                501L, 1L, "HCM26_CPL_JAVA_10", 101L, 1L, "JAVA_CORE",
                "Java Core & OOP Fundamentals", 1, 5L, "Nguyễn Văn A",
                "teacher@example.com", AssignmentRole.MAIN,
                LocalDate.of(2026, 10, 20), LocalDate.of(2026, 11, 30), true
        );

        when(classSetupService.getAssignmentsByTrainer(5L)).thenReturn(List.of(response));

        mockMvc.perform(get("/api/teaching-assignments").param("trainerId", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].trainerId").value(5))
                .andExpect(jsonPath("$[0].classCode").value("HCM26_CPL_JAVA_10"));
    }
}
