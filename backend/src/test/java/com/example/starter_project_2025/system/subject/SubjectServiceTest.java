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

import java.util.Optional;
import java.util.List;

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
    private SubjectUsageService usageService;

    @InjectMocks
    private SubjectServiceImpl subjectService;

    private Subject mockSubject;
    private SubjectDTO mockSubjectDTO;

    @BeforeEach
    void setUp() {
        lenient().when(usageService.getUsage(any())).thenReturn(new SubjectUsageService.Usage(0, 0, 0, 0));
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
        when(usageService.getUsage(10L)).thenReturn(new SubjectUsageService.Usage(0, 0, 1, 0));

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

        assertDoesNotThrow(() -> {
            subjectService.beforeDelete(mockSubject);
        });
    }

    @Test
    @DisplayName("isSubjectReferenced: Trả về true khi tìm thấy tham chiếu trong session")
    void isSubjectReferenced_ShouldReturnTrue_WhenSessionExists() {
        when(usageService.getUsage(10L)).thenReturn(new SubjectUsageService.Usage(0, 0, 1, 0));

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
        when(subjectRepository.existsByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0"), null)).thenReturn(true);

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

    @Test
    void createNormalizesCodeAndVersionBeforeDuplicateCheck() {
        mockSubjectDTO.setCode(" java_core ");
        mockSubjectDTO.setVersion(" V1.0 ");
        when(subjectRepository.existsByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0"), null)).thenReturn(true);
        ValidationContext ctx = new ValidationContext();
        subjectService.beforeCreate(mockSubject, mockSubjectDTO, ctx);
        assertTrue(ctx.getErrors().containsKey("code"));
        assertEquals("JAVA_CORE", mockSubject.getCode());
        assertEquals("1.0", mockSubject.getVersion());
        assertEquals("JAVA_CORE", mockSubjectDTO.getCode());
    }

    @Test
    void updateChecksNormalizedIdentityAndExcludesTheCurrentRecord() {
        mockSubjectDTO.setCode("java_core");
        mockSubjectDTO.setVersion("v1.0");
        ValidationContext ctx = new ValidationContext();
        subjectService.beforeUpdate(mockSubject, mockSubjectDTO, ctx);
        verify(subjectRepository).existsByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0"), 10L);
        assertFalse(ctx.hasErrors());
        assertEquals("1.0", mockSubjectDTO.getVersion());
    }

    @Test
    void updateRejectsAnotherRecordWithTheSameNormalizedIdentity() {
        when(subjectRepository.existsByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0"), 10L)).thenReturn(true);
        ValidationContext ctx = new ValidationContext();
        subjectService.beforeUpdate(mockSubject, mockSubjectDTO, ctx);
        assertTrue(ctx.getErrors().containsKey("code"));
    }

    @Test
    void partialUpdateChecksExistingIdentityAndRejectsBlankIdentity() {
        SubjectDTO partial = new SubjectDTO();
        ValidationContext ctx = new ValidationContext();
        subjectService.beforeUpdate(mockSubject, partial, ctx);
        assertFalse(ctx.hasErrors());
        assertEquals("JAVA_CORE", partial.getCode());
        assertEquals("1.0", partial.getVersion());
        partial.setCode(" ");
        ValidationContext blank = new ValidationContext();
        subjectService.beforeUpdate(mockSubject, partial, blank);
        assertTrue(blank.getErrors().containsKey("code"));
    }

    @Test
    void sameCodeWithADifferentVersionRemainsAllowed() {
        mockSubjectDTO.setVersion("v2.0");
        ValidationContext ctx = new ValidationContext();
        subjectService.beforeCreate(mockSubject, mockSubjectDTO, ctx);
        assertFalse(ctx.hasErrors());
        assertEquals("2.0", mockSubject.getVersion());
    }
}
