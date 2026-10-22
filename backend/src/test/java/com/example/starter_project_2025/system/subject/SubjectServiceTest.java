package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcOperations;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubjectServiceTest {

    @Mock
    private SubjectRepository subjectRepository;

    @Mock
    private SubjectMapper subjectMapper;

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
                .status(SubjectStatus.ACTIVE)
                .build();
        mockSubject.setId(10L);

        mockSubjectDTO = new SubjectDTO();
        mockSubjectDTO.setId(10L);
        mockSubjectDTO.setCode("JAVA_CORE");
        mockSubjectDTO.setName("Java Core Fundamentals");
        mockSubjectDTO.setVersion("1.0");
        mockSubjectDTO.setDurationHours(40);
        mockSubjectDTO.setIsActive(true);
        mockSubjectDTO.setStatus(SubjectStatus.ACTIVE);
    }

    @Test
    @DisplayName("beforeDelete: Ném BadRequestException khi môn học đã được tham chiếu trong hệ thống")
    void beforeDelete_ShouldThrowBadRequestException_WhenSubjectIsReferencedInSessions() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(1);

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
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(0);

        assertDoesNotThrow(() -> {
            subjectService.beforeDelete(mockSubject);
        });
    }

    @Test
    @DisplayName("isSubjectReferenced: Trả về true khi tìm thấy tham chiếu trong database")
    void isSubjectReferenced_ShouldReturnTrue_WhenSessionExists() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), any(Object[].class)))
                .thenReturn(2);

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
    @DisplayName("changeStatus: Cập nhật trạng thái và đồng bộ cả status lẫn isActive")
    void changeStatus_ShouldUpdateStatus() {
        when(subjectRepository.findById(10L)).thenReturn(Optional.of(mockSubject));
        when(subjectRepository.save(any(Subject.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(subjectMapper.toResponse(any(Subject.class))).thenReturn(mockSubjectDTO);

        SubjectDTO result = subjectService.changeStatus(10L, false);

        assertNotNull(result);
        assertFalse(mockSubject.getIsActive());
        assertEquals(SubjectStatus.INACTIVE, mockSubject.getStatus());
        verify(subjectRepository).save(mockSubject);
    }

    @Test
    @DisplayName("isCodeAvailable: Trả về true khi mã môn và phiên bản chưa tồn tại")
    void isCodeAvailable_ShouldReturnTrue_WhenNotExists() {
        when(subjectRepository.existsByCodeAndVersion("NEW_CODE", "1.0")).thenReturn(false);

        boolean available = subjectService.isCodeAvailable("NEW_CODE", "1.0", null);

        assertTrue(available);
        verify(subjectRepository).existsByCodeAndVersion("NEW_CODE", "1.0");
    }

    @Test
    @DisplayName("getSummary: Trả về thống kê số lượng môn học chính xác")
    void getSummary_ShouldReturnCorrectStatistics() {
        when(subjectRepository.findAll()).thenReturn(List.of(mockSubject));

        SubjectSummaryDTO summary = subjectService.getSummary();

        assertNotNull(summary);
        assertEquals(1, summary.getTotalSubjects());
        assertEquals(1, summary.getActiveSubjects());
        assertEquals(0, summary.getInactiveSubjects());
        assertTrue(summary.getCountByTechnicalGroup().containsKey("Backend"));
    }
}
