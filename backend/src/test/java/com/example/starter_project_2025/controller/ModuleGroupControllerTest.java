package com.example.starter_project_2025.controller;

import com.example.starter_project_2025.base.dataio.importer.service.ImportService;
import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.menu.module_groups.ModuleGroupController;
import com.example.starter_project_2025.system.menu.module_groups.ModuleGroupDTO;
import com.example.starter_project_2025.system.menu.module_groups.ModuleGroupRepository;
import com.example.starter_project_2025.system.menu.module_groups.ModuleGroupService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(value = ModuleGroupController.class,
        excludeFilters = @org.springframework.context.annotation.ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = com.example.starter_project_2025.security.JwtAuthenticationFilter.class
        ),
        excludeAutoConfiguration = {
                org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration.class,
                org.springframework.boot.autoconfigure.security.servlet.SecurityFilterAutoConfiguration.class,
                org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class,
                org.springframework.boot.autoconfigure.security.oauth2.client.servlet.OAuth2ClientAutoConfiguration.class,
                org.springframework.boot.autoconfigure.security.oauth2.resource.servlet.OAuth2ResourceServerAutoConfiguration.class
        })
@AutoConfigureMockMvc(addFilters = false)
public class ModuleGroupControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ModuleGroupService moduleGroupService;

    @MockBean
    private ModuleGroupRepository moduleGroupRepository;

    @MockBean
    private com.example.starter_project_2025.base.dataio.exporter.service.ExportService exportService;

    @MockBean
    private ImportService importService;

    private ModuleGroupDTO mockDto;

    @BeforeEach
    void setUp() {
        mockDto = new ModuleGroupDTO();
        mockDto.setName("System Group");
        mockDto.setDescription("Description");
        mockDto.setIsActive(true);
        mockDto.setDisplayOrder(0);
    }

    @Test
    @DisplayName("GET /api/module-groups - Should return paginated list")
    void getAll_ShouldReturnPage() throws Exception {
        when(moduleGroupService.getAll(any(Pageable.class), any(), any()))
                .thenReturn(new PageImpl<>(Collections.singletonList(mockDto)));

        mockMvc.perform(get("/api/module-groups"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].name").value("System Group"));
    }

    @Test
    @DisplayName("POST /api/module-groups - Should create new group")
    void create_ShouldReturnCreatedDto() throws Exception {
        when(moduleGroupService.create(any(ModuleGroupDTO.class))).thenReturn(mockDto);

        mockMvc.perform(post("/api/module-groups")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mockDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("System Group"));
    }

    @Test
    @DisplayName("PUT /api/module-groups/{id} - Should update and return updated DTO")
    void update_ShouldReturnUpdatedDto() throws Exception {
        Long id = 1L;
        mockDto.setName("Updated Name");

        when(moduleGroupService.update(eq(id), any(ModuleGroupDTO.class))).thenReturn(mockDto);

        mockMvc.perform(put("/api/module-groups/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mockDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Name"))
                .andExpect(jsonPath("$.description").value("Description"));

        verify(moduleGroupService, times(1)).update(eq(id), any(ModuleGroupDTO.class));
    }

    @Test
    @DisplayName("PUT /api/module-groups/{id} - Should return 400 when validation fails")
    void update_InvalidData_ShouldReturnBadRequest() throws Exception {
        mockDto.setName("");

        mockMvc.perform(put("/api/module-groups/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mockDto)))
                .andExpect(status().isBadRequest());

        verify(moduleGroupService, never()).update(anyLong(), any());
    }

    @Test
    @DisplayName("DELETE /api/module-groups/{id} - Should return No Content")
    void delete_ShouldReturnNoContent() throws Exception {
        mockMvc.perform(delete("/api/module-groups/1"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("GET /api/module-groups/export - Should trigger export service")
    void exportFile_ShouldReturnStatusOk() throws Exception {
        mockMvc.perform(get("/api/module-groups/export")
                        .param("format", "EXCEL"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/module-groups/import - Should handle file upload")
    void importFile_ShouldReturnImportResult() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "test data".getBytes()
        );

        when(importService.importFile(any(), any(), any())).thenReturn(null);

        mockMvc.perform(multipart("/api/module-groups/import")
                        .file(file))
                .andExpect(status().isOk());
    }
}
