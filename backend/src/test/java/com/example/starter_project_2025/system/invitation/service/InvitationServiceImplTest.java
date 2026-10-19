package com.example.starter_project_2025.system.invitation.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.invitation.audit.InvitationAuditService;
import com.example.starter_project_2025.system.invitation.domain.Invitation;
import com.example.starter_project_2025.system.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.invitation.domain.InvitationStatus;
import com.example.starter_project_2025.system.invitation.dto.InvitationDTO;
import com.example.starter_project_2025.system.invitation.mapper.InvitationMapper;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvitationServiceImplTest {

    @Mock
    private InvitationRepository repository;

    @Mock
    private InvitationMapper mapper;

    @Mock
    private InvitationValidator validator;

    @Mock
    private InvitationAuditService auditService;

    @InjectMocks
    private InvitationServiceImpl invitationService;

    private Exam exam;
    private User user;
    private Invitation invitation;
    private InvitationDTO dto;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "teacher@example.com",
                        "password",
                        List.of(
                                new SimpleGrantedAuthority("INVITATION_READ"),
                                new SimpleGrantedAuthority("INVITATION_CREATE"),
                                new SimpleGrantedAuthority("INVITATION_UPDATE"),
                                new SimpleGrantedAuthority("INVITATION_DELETE")
                        )
                )
        );

        exam = new Exam();
        exam.setId(1L);
        exam.setTitle("Thi Giua Ky Java");
        exam.setIsActive(true);

        user = new User();
        user.setId(2L);
        user.setEmail("student@example.com");
        user.setFirstName("Van A");
        user.setIsActive(true);

        invitation = Invitation.builder()
                .id(100L)
                .exam(exam)
                .user(user)
                .status(InvitationStatus.PENDING)
                .resendCount(0)
                .isActive(true)
                .build();

        dto = new InvitationDTO();
        dto.setExamId(1L);
        dto.setUserId(2L);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Create invitation initializes status to PENDING and logs audit")
    void create_ShouldInitializePendingAndLogAudit() {
        when(mapper.toEntity(dto)).thenReturn(invitation);
        when(repository.save(invitation)).thenReturn(invitation);
        when(mapper.toResponse(invitation)).thenReturn(dto);

        InvitationDTO result = invitationService.create(dto);

        assertNotNull(result);
        assertEquals(InvitationStatus.PENDING, invitation.getStatus());
        assertNotNull(invitation.getSentAt());
        assertEquals(0, invitation.getResendCount());
        verify(validator).validateForCreate(eq(dto), any(ValidationContext.class));
        verify(repository).save(invitation);
        verify(auditService).log(eq(100L), eq(1L), eq(2L), eq("CREATE"), anyString());
    }

    @Test
    @DisplayName("Get by ID returns response when found")
    void getById_WhenFound_ReturnsDTO() {
        when(repository.findById(100L)).thenReturn(Optional.of(invitation));
        when(mapper.toResponse(invitation)).thenReturn(dto);

        InvitationDTO result = invitationService.getById(100L);

        assertSame(dto, result);
        verify(repository).findById(100L);
    }

    @Test
    @DisplayName("Get by ID throws ResourceNotFoundException when not found")
    void getById_WhenNotFound_ThrowsException() {
        when(repository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> invitationService.getById(999L));
    }

    @Test
    @DisplayName("Update updates allowed fields and logs audit")
    void update_WhenValid_UpdatesAndLogsAudit() {
        when(repository.findById(100L)).thenReturn(Optional.of(invitation));
        when(repository.save(invitation)).thenReturn(invitation);
        when(mapper.toResponse(invitation)).thenReturn(dto);

        InvitationDTO result = invitationService.update(100L, dto);

        assertNotNull(result);
        verify(validator).validateForUpdate(eq(invitation), eq(dto), any(ValidationContext.class));
        verify(mapper).update(invitation, dto);
        verify(repository).save(invitation);
        verify(auditService).log(eq(100L), eq(1L), eq(2L), eq("UPDATE"), anyString());
    }

    @Test
    @DisplayName("Delete deletes entity and logs audit")
    void delete_WhenFound_DeletesAndLogsAudit() {
        when(repository.findById(100L)).thenReturn(Optional.of(invitation));

        invitationService.delete(100L);

        verify(repository).delete(invitation);
        verify(auditService).log(eq(100L), eq(1L), eq(2L), eq("DELETE"), anyString());
    }

    @Test
    @DisplayName("Throws AccessDeniedException when missing permission")
    void checkPermission_WhenUnauthorized_ThrowsAccessDenied() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "student@example.com",
                        "password",
                        List.of(new SimpleGrantedAuthority("MENU_READ"))
                )
        );

        assertThrows(AccessDeniedException.class, () -> invitationService.getById(100L));
    }
}
