package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcOperations;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubjectServiceTest {

    @Mock
    private SubjectRepository subjectRepository;

    @Mock
    private SubjectMapper subjectMapper;

    @Mock
    private SessionRepository sessionRepository;

    @Mock
    private JdbcOperations jdbcTemplate;

    @InjectMocks
    private SubjectServiceImpl subjectService;

    private Subject mockSubject;
    private SubjectDTO mockSubjectDTO;

    @BeforeEach
    void setUp() {
        mockSubject = Subject.builder()
                .code("JAVA_CORE")
                .name("Java Core Fundamentals")
                .version("1.0")
                .technicalGroup("Backend")
                .durationHours(40)
                .isActive(true)
                .build();
        mockSubject.setId(10L);

        mockSubjectDTO = new SubjectDTO();
        mockSubjectDTO.setId(10L);
        mockSubjectDTO.setCode("JAVA_CORE");
        mockSubjectDTO.setName("Java Core Fundamentals");
        mockSubjectDTO.setVersion("1.0");
        mockSubjectDTO.setDurationHours(40);
    }

    @Test
    @DisplayName("beforeDelete: Ném BadRequestException khi môn học đã được tham chiếu trong Session")
    void beforeDelete_ShouldThrowBadRequestException_WhenSubjectIsReferencedInSessions() {
        when(sessionRepository.existsByTopicId(10L)).thenReturn(true);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> {
            subjectService.beforeDelete(mockSubject);
        });

        assertTrue(ex.getMessage().contains("JAVA_CORE"));
        assertTrue(ex.getMessage().contains("1.0"));
        assertTrue(ex.getMessage().contains("Không thể xóa môn học"));
    }

    @Test
    @DisplayName("beforeDelete: Thành công không ném lỗi khi môn học chưa từng được tham chiếu")
    void beforeDelete_ShouldPass_WhenSubjectIsNotReferenced() {
        when(sessionRepository.existsByTopicId(10L)).thenReturn(false);

        assertDoesNotThrow(() -> {
            subjectService.beforeDelete(mockSubject);
        });
    }

    @Test
    @DisplayName("isSubjectReferenced: Trả về true khi tìm thấy tham chiếu trong session")
    void isSubjectReferenced_ShouldReturnTrue_WhenSessionExists() {
        when(sessionRepository.existsByTopicId(10L)).thenReturn(true);

        boolean referenced = subjectService.isSubjectReferenced(10L);
        assertTrue(referenced);
    }

    @Test
    @DisplayName("isSubjectReferenced: Trả về false khi id là null hoặc không có tham chiếu")
    void isSubjectReferenced_ShouldReturnFalse_WhenIdIsNull() {
        assertFalse(subjectService.isSubjectReferenced(null));
    }

    @Test
    @DisplayName("beforeCreate: Thêm lỗi validation khi trùng mã và phiên bản")
    void beforeCreate_ShouldAddError_WhenCodeAndVersionDuplicate() {
        when(subjectRepository.existsByCodeAndVersion("JAVA_CORE", "1.0")).thenReturn(true);

        ValidationContext ctx = new ValidationContext();
        subjectService.beforeCreate(mockSubject, mockSubjectDTO, ctx);

        assertTrue(ctx.hasErrors());
        assertTrue(ctx.getErrors().containsKey("code"));
    }

    @Test
    @DisplayName("changeStatus: Cập nhật trạng thái thành công")
    void changeStatus_ShouldUpdateStatus() {
        when(subjectRepository.findById(10L)).thenReturn(Optional.of(mockSubject));
        when(subjectRepository.save(any(Subject.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(subjectMapper.toResponse(any(Subject.class))).thenReturn(mockSubjectDTO);

        SubjectDTO result = subjectService.changeStatus(10L, false);

        assertNotNull(result);
        assertFalse(mockSubject.getIsActive());
        verify(subjectRepository).save(mockSubject);
    }
}
