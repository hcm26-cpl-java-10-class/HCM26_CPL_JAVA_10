package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.dataio.importer.parser.ExcelParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.template.registry.ImportEntityRegistry;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ClassImportServiceTest {
    private final ClassSetupService classSetupService = mock(ClassSetupService.class);
    private final ExternalApiService externalApiService = mock(ExternalApiService.class);
    private final TrainingProgramRepository trainingProgramRepository = mock(TrainingProgramRepository.class);
    private ValidatorFactory validatorFactory;
    private Validator validator;
    private ClassImportService importService;

    @BeforeEach
    void setUp() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
        importService = new ClassImportService(
                new ParserFactory(List.of(new ExcelParser())), classSetupService, externalApiService,
                trainingProgramRepository, validator);
    }

    @AfterEach
    void tearDown() {
        validatorFactory.close();
    }

    @Test
    void importsClassFromExcelAndConvertsNumericTraineeCount() throws Exception {
        when(externalApiService.fetchClasses(null)).thenReturn(List.of());
        when(trainingProgramRepository.findAll()).thenReturn(List.of());
        when(classSetupService.createClass(any(ExternalClassRequest.class)))
                .thenReturn(ExternalClassDTO.builder().id(88L).code("EXCEL_JAVA_01").build());

        var result = importService.importFile(new MockMultipartFile(
                "file", "classes.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                createWorkbook()));

        assertEquals(1, result.getSuccessCount());
        assertEquals(0, result.getFailureCount());
        var request = forClass(ExternalClassRequest.class);
        verify(classSetupService).createClass(request.capture());
        assertEquals("2027-01-20", request.getValue().startDate());
        assertEquals(12, request.getValue().plannedSize());
    }

    @Test
    void registersClassSetupExcelTemplate() {
        assertEquals(ClassImportTemplate.class, new ImportEntityRegistry().getEntity("class-setup"));
    }

    private byte[] createWorkbook() throws Exception {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Classes");
            Row header = sheet.createRow(0);
            header.createCell(0).setCellValue("Class Code");
            header.createCell(1).setCellValue("Class Name");
            header.createCell(2).setCellValue("Expected Start Date");
            header.createCell(3).setCellValue("Planned Trainee No.");

            Row row = sheet.createRow(1);
            row.createCell(0).setCellValue("EXCEL_JAVA_01");
            row.createCell(1).setCellValue("Excel Java Class");
            row.createCell(2).setCellValue(DateUtil.getExcelDate(LocalDate.of(2027, 1, 20).atStartOfDay()));
            row.createCell(3).setCellValue(12);

            workbook.write(output);
            return output.toByteArray();
        }
    }
}
