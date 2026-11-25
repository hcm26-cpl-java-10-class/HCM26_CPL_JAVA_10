package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.dataio.exporter.service.ExportService;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.service.ImportService;
import com.example.starter_project_2025.security.JwtAuthenticationFilter;
import com.example.starter_project_2025.security.UserDetailsServiceImpl;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.oauth2.client.servlet.OAuth2ClientAutoConfiguration;
import org.springframework.boot.autoconfigure.security.oauth2.resource.servlet.OAuth2ResourceServerAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.SQLException;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(
        value = SubjectController.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = JwtAuthenticationFilter.class
        ),
        excludeAutoConfiguration = {
                SecurityAutoConfiguration.class,
                SecurityFilterAutoConfiguration.class,
                UserDetailsServiceAutoConfiguration.class,
                OAuth2ClientAutoConfiguration.class,
                OAuth2ResourceServerAutoConfiguration.class
        }
)
@Import(SubjectExceptionHandler.class)
@AutoConfigureMockMvc(addFilters = false)
class SubjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SubjectService subjectService;
    @MockBean
    private SubjectSyllabusService subjectSyllabusService;
    @MockBean
    private SubjectRepository subjectRepository;
    @MockBean
    private SubjectImportService subjectImportService;
    @MockBean
    private SubjectImportTemplateProvider subjectImportTemplateProvider;
    @MockBean
    private ExportService exportService;
    @MockBean
    private ImportService importService;
    @MockBean
    private RefreshTokenService refreshTokenService;
    @MockBean
    private UserDetailsServiceImpl userDetailsService;

    @Test
    void create_validatesMaxDurationAndNumericTechnicalGroup() throws Exception {
        SubjectDTO invalid = SubjectDTO.builder()
                .code("JAVA_CORE")
                .name("Java Core")
                .version("1.0")
                .technicalGroup("12345")
                .durationHours(1500)
                .build();

        mockMvc.perform(post("/api/topics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void create_supportsBothTopicsAndSubjectsAliasAndMapsDuplicateTo409() throws Exception {
        SubjectDTO request = SubjectDTO.builder()
                .code("JAVA_CORE")
                .name("Java Core")
                .version("1.0")
                .technicalGroup("Java")
                .durationHours(40)
                .build();

        when(subjectService.create(any(SubjectDTO.class))).thenReturn(request);

        mockMvc.perform(post("/api/subjects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("JAVA_CORE"));

        ConstraintViolationException hibernateEx = new ConstraintViolationException(
                "duplicate", new SQLException("duplicate"), "uk_subject_code_version");
        when(subjectService.create(any(SubjectDTO.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate", hibernateEx));

        mockMvc.perform(post("/api/topics")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors.code[0]").value(SubjectExceptionHandler.DUPLICATE_MESSAGE));
    }

    @Test
    void importTemplate_returnsWorkbookBytes() throws Exception {
        byte[] sampleBytes = new byte[]{0x50, 0x4B, 0x03, 0x04};
        when(subjectImportTemplateProvider.generate(Subject.class)).thenReturn(sampleBytes);

        mockMvc.perform(get("/api/topics/import/template"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=topic-import-template.xlsx"))
                .andExpect(content().bytes(sampleBytes));
    }

    @Test
    void commitImport_delegatesAndReturnsResult() throws Exception {
        ImportResult result = new ImportResult();
        result.setTotalCount(1);
        result.setSuccessCount(1);
        when(subjectImportService.commitRows(anyList())).thenReturn(result);

        SubjectDTO row = SubjectDTO.builder()
                .code("JAVA_CORE")
                .name("Java Core")
                .version("1.0")
                .durationHours(40)
                .build();

        mockMvc.perform(post("/api/topics/import/commit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(row))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successCount").value(1));
    }
}
