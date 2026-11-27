package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.dataio.importer.parser.CsvParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ExcelParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.subject.dto.TopicImportPreviewResponse;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubjectImportServiceTest {

    @Mock
    private SubjectRepository subjectRepository;

    private SubjectMapper subjectMapper;
    private SubjectImportService importService;
    private SubjectImportTemplateProvider templateProvider;

    @BeforeEach
    void setUp() {
        subjectMapper = Mappers.getMapper(SubjectMapper.class);
        Validator beanValidator = Validation.buildDefaultValidatorFactory().getValidator();
        SubjectValidator subjectValidator = new SubjectValidator(subjectRepository, beanValidator);
        ParserFactory parserFactory = new ParserFactory(List.of(new CsvParser(), new ExcelParser()));
        importService = new SubjectImportService(
                parserFactory,
                subjectMapper,
                subjectRepository,
                subjectValidator
        );
        templateProvider = new SubjectImportTemplateProvider();
    }

    @Test
    void templateProvider_generatesValidParseableXlsx() {
        byte[] xlsx = templateProvider.generate(Subject.class);
        assertNotNull(xlsx);
        assertTrue(xlsx.length > 0);
        assertEquals("subject", templateProvider.entity());
    }

    @Test
    void preview_validatesRowsWithSingleBatchDbCheck() {
        String csv = """
                Code,Name,Version,Technical Group,Duration (Hours),Description,Status
                java_core,Java Core,v1.0,Java,40,Valid row,ACTIVE
                java_core,Java Duplicate,1.0,Java,32,Duplicate in file,HOẠT ĐỘNG
                BAD_NUM,Bad Tech Group,1.0,12345,1001,Numeric group and duration too high,INVALID_STATUS
                EXISTING_SUB,Existing Subject,1.0,Backend,20,Already in DB,1
                """;
        MockMultipartFile file = new MockMultipartFile(
                "file", "topics.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        when(subjectRepository.findIdentityPairsByCodes(anyCollection()))
                .thenReturn(List.<Object[]>of(new Object[]{"EXISTING_SUB", "v1.0"}));

        TopicImportPreviewResponse response = importService.preview(file);

        assertEquals(4, response.totalRows());
        assertEquals(1, response.validRows());
        assertEquals(3, response.invalidRows());
        assertFalse(response.canImport());
        assertTrue(response.rows().get(0).valid());
        assertTrue(response.rows().get(1).errors().stream().anyMatch(e -> e.contains("Duplicate")));
        assertFalse(response.rows().get(2).valid());
        assertTrue(response.rows().get(2).errors().size() >= 3);
        assertTrue(response.rows().get(3).errors().stream().anyMatch(e -> e.contains("already exists")));

        verify(subjectRepository, times(1)).findIdentityPairsByCodes(anyCollection());
        verify(subjectRepository, never()).existsByNormalizedIdentity(anyString(), anyList(), any());
    }

    @Test
    void importFile_savesValidBatchInOnePass() {
        String csv = """
                Code,Name,Version,Technical Group,Duration (Hours),Description,Status
                spring_boot,Spring Boot,1.0,Java,48,REST APIs,ACTIVE
                react_ts,React & TS,v2.0,Frontend,40,SPA,INACTIVE
                """;
        MockMultipartFile file = new MockMultipartFile(
                "file", "valid.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        when(subjectRepository.findIdentityPairsByCodes(anyCollection())).thenReturn(List.of());
        when(subjectRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        ImportResult result = importService.importFile(file);

        assertEquals(2, result.getSuccessCount());
        assertEquals(2, result.getTotalCount());
        verify(subjectRepository, times(1)).saveAll(argThat(list -> {
            var it = list.iterator();
            Subject first = it.next();
            Subject second = it.next();
            return "SPRING_BOOT".equals(first.getCode())
                    && "REACT_TS".equals(second.getCode())
                    && "2.0".equals(second.getVersion())
                    && SubjectStatus.INACTIVE == second.getStatus();
        }));
    }

    @Test
    void importFile_rejectsAndRollsBackWhenAnyRowInvalid() {
        String csv = """
                Code,Name,Version,Technical Group,Duration (Hours),Description,Status
                spring_boot,Spring Boot,1.0,Java,48,Valid,ACTIVE
                bad_row,,1.0,999,0,Invalid,ACTIVE
                """;
        MockMultipartFile file = new MockMultipartFile(
                "file", "invalid.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8));

        when(subjectRepository.findIdentityPairsByCodes(anyCollection())).thenReturn(List.of());

        BadRequestException ex = assertThrows(BadRequestException.class, () -> importService.importFile(file));
        assertTrue(ex.getMessage().contains("1 row(s) with errors"));
        verify(subjectRepository, never()).saveAll(anyList());
    }

    @Test
    void commitRows_collectsAllRowErrorsInsteadOfFailingFast() {
        SubjectDTO row1 = SubjectDTO.builder()
                .code("")
                .name("Row 1")
                .version("1.0")
                .durationHours(10)
                .build();
        SubjectDTO row2 = SubjectDTO.builder()
                .code("ROW_2")
                .name("Row 2")
                .version("1.0")
                .technicalGroup("123")
                .durationHours(2000)
                .build();

        when(subjectRepository.findIdentityPairsByCodes(anyCollection())).thenReturn(List.of());

        BadRequestException ex = assertThrows(
                BadRequestException.class,
                () -> importService.commitRows(List.of(row1, row2))
        );
        assertTrue(ex.getMessage().contains("Row 1:"));
        assertTrue(ex.getMessage().contains("Row 2:"));
        verify(subjectRepository, never()).saveAll(anyList());
    }
}

