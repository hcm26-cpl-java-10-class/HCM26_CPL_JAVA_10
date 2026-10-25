package com.example.starter_project_2025.system.invitation;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.invitation.audit.InvitationAuditLog;
import com.example.starter_project_2025.system.invitation.audit.InvitationAuditRepository;
import com.example.starter_project_2025.system.invitation.domain.Invitation;
import com.example.starter_project_2025.system.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.invitation.dto.BatchInvitationRequest;
import com.example.starter_project_2025.system.invitation.dto.InvitationDTO;
import com.example.starter_project_2025.system.invitation.dto.RevokeInvitationRequest;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
public class InvitationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private ExamRepository examRepository;

    @org.springframework.boot.test.mock.mockito.MockBean
    private com.example.starter_project_2025.system.auth.util.MailUtil mailUtil;

    @Autowired
    private InvitationRepository invitationRepository;

    @Autowired
    private InvitationAuditRepository auditRepository;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private org.springframework.security.core.userdetails.UserDetailsService userDetailsService;

    @Autowired
    private org.springframework.transaction.support.TransactionTemplate transactionTemplate;

    private String teacherToken;
    private String studentToken;

    private Exam testExam;
    private Exam inactiveExam;
    private User student1;
    private User student2;
    private User inactiveStudent;
    private User nonStudentUser;

    @BeforeEach
    void setUp() {
        invitationRepository.deleteAll();
        auditRepository.deleteAll();

        transactionTemplate.executeWithoutResult(status -> {
            // 1. Setup Teacher & Student Tokens
            org.springframework.security.core.userdetails.UserDetails teacher = userDetailsService.loadUserByUsername("teacher@example.com");
            teacherToken = refreshTokenService.generateAccessToken(
                    new UsernamePasswordAuthenticationToken(teacher, null, teacher.getAuthorities())
            );

            org.springframework.security.core.userdetails.UserDetails student = userDetailsService.loadUserByUsername("student@example.com");
            studentToken = refreshTokenService.generateAccessToken(
                    new UsernamePasswordAuthenticationToken(student, null, student.getAuthorities())
            );

            // 2. Setup Test Exam
            testExam = new Exam();
            testExam.setTitle("Ky Thi Tot Nghiep Java 2026");
            testExam.setDurationMinutes(60);
            testExam.setIsActive(true);
            testExam = examRepository.save(testExam);

            inactiveExam = new Exam();
            inactiveExam.setTitle("Ky Thi Da Dong");
            inactiveExam.setDurationMinutes(30);
            inactiveExam.setIsActive(false);
            inactiveExam = examRepository.save(inactiveExam);

            // 3. Setup Students
            Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();

            student1 = userRepository.findByEmail("student@example.com").orElseThrow();

            student2 = userRepository.findByEmail("student2@example.com").orElseGet(() -> {
                User u = new User();
                u.setEmail("student2@example.com");
                u.setPasswordHash("hashedpwd");
                u.setFirstName("Hoc Sinh");
                u.setLastName("So 2");
                u.setIsActive(true);
                u.setRoles(new HashSet<>(Set.of(studentRole)));
                return userRepository.save(u);
            });

            inactiveStudent = userRepository.findByEmail("inactive_student@example.com").orElseGet(() -> {
                User u = new User();
                u.setEmail("inactive_student@example.com");
                u.setPasswordHash("hashedpwd");
                u.setFirstName("Hoc Sinh");
                u.setLastName("Bi Khoa");
                u.setIsActive(false);
                u.setRoles(new HashSet<>(Set.of(studentRole)));
                return userRepository.save(u);
            });

            // Non-student (e.g. user without STUDENT role)
            Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
            nonStudentUser = userRepository.findByEmail("other_teacher@example.com").orElseGet(() -> {
                User u = new User();
                u.setEmail("other_teacher@example.com");
                u.setPasswordHash("hashedpwd");
                u.setFirstName("Giao Vien");
                u.setLastName("Khac");
                u.setIsActive(true);
                u.setRoles(new HashSet<>(Set.of(teacherRole)));
                return userRepository.save(u);
            });
        });
    }

    // 1. Tạo lời mời thành công
    @Test
    @DisplayName("1. POST /api/invitations - Tạo lời mời thành công, status PENDING, sinh audit log")
    void createInvitation_Success() throws Exception {
        InvitationDTO dto = new InvitationDTO();
        dto.setExamId(testExam.getId());
        dto.setUserId(student1.getId());
        dto.setNote("Mời tham gia kỳ thi đợt 1");
        dto.setIsActive(true);

        mockMvc.perform(post("/api/invitations")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.examId").value(testExam.getId()))
                .andExpect(jsonPath("$.userId").value(student1.getId()))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.resendCount").value(0))
                .andExpect(jsonPath("$.sentAt").isNotEmpty());

        List<InvitationAuditLog> auditLogs = auditRepository.findByExamIdOrderByCreatedAtDesc(testExam.getId());
        assertFalse(auditLogs.isEmpty());
        assertEquals("CREATE", auditLogs.get(0).getAction());
    }

    // 2. Không tạo lời mời trùng
    @Test
    @DisplayName("2. POST /api/invitations - Báo lỗi khi tạo lời mời trùng lặp cùng một học sinh trong kỳ thi (400)")
    void createInvitation_Duplicate_ReturnsBadRequest() throws Exception {
        InvitationDTO dto = new InvitationDTO();
        dto.setExamId(testExam.getId());
        dto.setUserId(student1.getId());
        dto.setIsActive(true);

        // First call: Success
        mockMvc.perform(post("/api/invitations")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk());

        // Second call: Duplicate rejected
        mockMvc.perform(post("/api/invitations")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.invitation", hasItem("Lời mời cho người dùng này đã tồn tại trong kỳ thi")));
    }

    // 3. Người được mời không tồn tại
    @Test
    @DisplayName("3. POST /api/invitations - Báo lỗi khi người được mời không tồn tại (400)")
    void createInvitation_UserNotFound_ReturnsBadRequest() throws Exception {
        InvitationDTO dto = new InvitationDTO();
        dto.setExamId(testExam.getId());
        dto.setUserId(999999L);
        dto.setIsActive(true);

        mockMvc.perform(post("/api/invitations")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.userId", hasItem(containsString("Không tìm thấy người dùng"))));
    }

    // 4. Người được mời không đủ điều kiện
    @Test
    @DisplayName("4. POST /api/invitations - Báo lỗi khi người dùng bị vô hiệu hóa hoặc không phải học sinh (400)")
    void createInvitation_UserNotEligible_ReturnsBadRequest() throws Exception {
        // Case A: Inactive user
        InvitationDTO dtoInactive = new InvitationDTO();
        dtoInactive.setExamId(testExam.getId());
        dtoInactive.setUserId(inactiveStudent.getId());
        dtoInactive.setIsActive(true);

        mockMvc.perform(post("/api/invitations")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dtoInactive)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.userId", hasItem(containsString("Người dùng đã bị vô hiệu hóa"))));

        // Case B: Non-student user
        InvitationDTO dtoNonStudent = new InvitationDTO();
        dtoNonStudent.setExamId(testExam.getId());
        dtoNonStudent.setUserId(nonStudentUser.getId());
        dtoNonStudent.setIsActive(true);

        mockMvc.perform(post("/api/invitations")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dtoNonStudent)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.userId", hasItem(containsString("Người dùng không có vai trò học sinh"))));
    }

    // 5. Mời hàng loạt có cả người hợp lệ và không hợp lệ + 6. Trả đúng kết quả riêng cho từng người
    @Test
    @DisplayName("5 & 6. POST /api/invitations/actions/batch - Xử lý độc lập, trả kết quả riêng cho từng người")
    void batchInvitation_MixedItems_ProcessesIndependently() throws Exception {
        BatchInvitationRequest request = BatchInvitationRequest.builder()
                .examId(testExam.getId())
                .userIds(List.of(
                        student1.getId(),        // Hợp lệ -> SUCCESS
                        student2.getId(),        // Hợp lệ -> SUCCESS
                        inactiveStudent.getId(), // Không đủ điều kiện -> FAILED
                        999999L,                 // Không tồn tại -> FAILED
                        student1.getId()         // Trùng ID trong request -> SKIPPED
                ))
                .note("Mời thi batch")
                .build();

        mockMvc.perform(post("/api/invitations/actions/batch")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRequested").value(5))
                .andExpect(jsonPath("$.successCount").value(2))
                .andExpect(jsonPath("$.skippedCount").value(1))
                .andExpect(jsonPath("$.failedCount").value(2))
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.items[0].status").value("SUCCESS"))
                .andExpect(jsonPath("$.items[1].status").value("SUCCESS"))
                .andExpect(jsonPath("$.items[2].status").value("FAILED"))
                .andExpect(jsonPath("$.items[3].status").value("FAILED"))
                .andExpect(jsonPath("$.items[4].status").value("SKIPPED"));

        // Xác nhận trong DB chỉ lưu 2 bản ghi hợp lệ
        assertEquals(2, invitationRepository.count());
    }

    // 7. Chạy lại batch không tạo trùng
    @Test
    @DisplayName("7. POST /api/invitations/actions/batch - Chạy lại batch lần 2 không tạo trùng, chuyển sang SKIPPED")
    void batchInvitation_Rerun_DoesNotCreateDuplicates() throws Exception {
        BatchInvitationRequest request = BatchInvitationRequest.builder()
                .examId(testExam.getId())
                .userIds(List.of(student1.getId(), student2.getId()))
                .build();

        // Lần 1: Cả 2 thành công
        mockMvc.perform(post("/api/invitations/actions/batch")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(2))
                .andExpect(jsonPath("$.skippedCount").value(0));

        assertEquals(2, invitationRepository.count());

        // Lần 2: Chạy lại cùng request -> Cả 2 chuyển thành SKIPPED
        mockMvc.perform(post("/api/invitations/actions/batch")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(0))
                .andExpect(jsonPath("$.skippedCount").value(2))
                .andExpect(jsonPath("$.failedCount").value(0))
                .andExpect(jsonPath("$.items[0].status").value("SKIPPED"))
                .andExpect(jsonPath("$.items[1].status").value("SKIPPED"));

        // Tổng số bản ghi trong DB vẫn là 2
        assertEquals(2, invitationRepository.count());
    }

    // 8. Gửi lại lời mời ở trạng thái hợp lệ và không hợp lệ
    @Test
    @DisplayName("8. POST /api/invitations/{id}/resend - Gửi lại thành công khi PENDING, từ chối khi REVOKED")
    void resendInvitation_ValidAndInvalidStatus() throws Exception {
        Invitation invitation = Invitation.builder()
                .exam(testExam)
                .user(student1)
                .status(InvitationStatus.PENDING)
                .resendCount(0)
                .isActive(true)
                .build();
        invitation = invitationRepository.save(invitation);

        // A. Resend on PENDING -> Success, count = 1
        mockMvc.perform(post("/api/invitations/" + invitation.getId() + "/resend")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resendCount").value(1));

        // Resend lần nữa -> count = 2
        mockMvc.perform(post("/api/invitations/" + invitation.getId() + "/resend")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resendCount").value(2));

        // Chuyển sang REVOKED
        invitation.setStatus(InvitationStatus.REVOKED);
        invitationRepository.save(invitation);

        // B. Resend on REVOKED -> BadRequest (400)
        mockMvc.perform(post("/api/invitations/" + invitation.getId() + "/resend")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.status", hasItem(containsString("Chỉ có thể gửi lại lời mời ở trạng thái PENDING"))));
    }

    // 9. Thu hồi lời mời thành công + 10. Thu hồi sai trạng thái / không tồn tại
    @Test
    @DisplayName("9 & 10. POST /api/invitations/{id}/revoke - Thu hồi thành công, từ chối khi sai trạng thái hoặc không tồn tại")
    void revokeInvitation_SuccessAndInvalidState() throws Exception {
        Invitation invitation = Invitation.builder()
                .exam(testExam)
                .user(student1)
                .status(InvitationStatus.PENDING)
                .isActive(true)
                .build();
        invitation = invitationRepository.save(invitation);

        RevokeInvitationRequest req = new RevokeInvitationRequest("Học sinh nghỉ học");

        // A. Thu hồi thành công
        mockMvc.perform(post("/api/invitations/" + invitation.getId() + "/revoke")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVOKED"))
                .andExpect(jsonPath("$.revokedReason").value("Học sinh nghỉ học"))
                .andExpect(jsonPath("$.revokedAt").isNotEmpty());

        // B. Thu hồi lại lần nữa trên lời mời đã REVOKED -> 400
        mockMvc.perform(post("/api/invitations/" + invitation.getId() + "/revoke")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.status", hasItem("Lời mời đã được thu hồi trước đó")));

        // C. Thu hồi ID không tồn tại -> 404
        mockMvc.perform(post("/api/invitations/999999/revoke")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isNotFound());
    }

    // 11. Người không có quyền INVITATION bị từ chối 403 Forbidden
    @Test
    @DisplayName("11. Học sinh không có quyền INVITATION bị từ chối 403 khi gọi API mời")
    void student_WithoutInvitationPermission_ReturnsForbidden() throws Exception {
        BatchInvitationRequest req = BatchInvitationRequest.builder()
                .examId(testExam.getId())
                .userIds(List.of(student1.getId()))
                .build();

        mockMvc.perform(post("/api/invitations/actions/batch")
                        .header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden());
    }

    // 12. Kiểm tra Audit Log
    @Test
    @DisplayName("12. Kiểm tra sinh đầy đủ audit log cho CREATE, RESEND, REVOKE")
    void verifyAuditLogs_RecordedCorrectly() throws Exception {
        InvitationDTO dto = new InvitationDTO();
        dto.setExamId(testExam.getId());
        dto.setUserId(student1.getId());
        dto.setIsActive(true);

        // Tạo
        String createResp = mockMvc.perform(post("/api/invitations")
                        .header("Authorization", "Bearer " + teacherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        InvitationDTO created = objectMapper.readValue(createResp, InvitationDTO.class);

        // Gửi lại
        mockMvc.perform(post("/api/invitations/" + created.getId() + "/resend")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk());

        // Thu hồi
        mockMvc.perform(post("/api/invitations/" + created.getId() + "/revoke")
                        .header("Authorization", "Bearer " + teacherToken))
                .andExpect(status().isOk());

        List<InvitationAuditLog> logs = auditRepository.findByInvitationIdOrderByCreatedAtDesc(created.getId());
        assertEquals(3, logs.size());
        assertEquals("REVOKE", logs.get(0).getAction());
        assertEquals("RESEND", logs.get(1).getAction());
        assertEquals("CREATE", logs.get(2).getAction());
    }

    // 13. CRUD query filter và search
    @Test
    @DisplayName("13. GET /api/invitations - Lấy danh sách phân trang kèm filter và search")
    void getInvitations_WithFilterAndSearch() throws Exception {
        Invitation inv1 = Invitation.builder()
                .exam(testExam)
                .user(student1)
                .status(InvitationStatus.PENDING)
                .note("Ghi chu dac biet Alpha")
                .isActive(true)
                .build();

        Invitation inv2 = Invitation.builder()
                .exam(testExam)
                .user(student2)
                .status(InvitationStatus.REVOKED)
                .note("Ghi chu Beta")
                .isActive(true)
                .build();

        invitationRepository.saveAll(List.of(inv1, inv2));

        // Filter by status = PENDING
        mockMvc.perform(get("/api/invitations")
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].note").value("Ghi chu dac biet Alpha"));

        // Search by keyword "Alpha"
        mockMvc.perform(get("/api/invitations")
                        .header("Authorization", "Bearer " + teacherToken)
                        .param("search", "Alpha"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].note").value("Ghi chu dac biet Alpha"));
    }
}
