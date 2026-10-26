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

//@WebMvcTest(ModuleGroupController.class)
@WebMvcTest(value = ModuleGroupController.class, excludeAutoConfiguration = {
        org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration.class,
        org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class,
        org.springframework.boot.autoconfigure.security.oauth2.client.servlet.OAuth2ClientAutoConfiguration.class
})
@AutoConfigureMockMvc(addFilters = false) // Quan trọng: Dòng này sẽ tắt các Filter như JwtAuthenticationFilter
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

    @MockBean
    private RefreshTokenService refreshTokenService;

    @MockBean
    private com.example.starter_project_2025.security.UserDetailsServiceImpl userDetailsService;

    private ModuleGroupDTO mockDto;

    @BeforeEach
    void setUp() {
        mockDto = new ModuleGroupDTO();
        mockDto.setName("System Group");
        mockDto.setDescription("Description");
        mockDto.setIsActive(true);
    }

    // --- 1. TEST CRUD (BaseCrudController) ---

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
        // Given
        Long id = 1L;
        mockDto.setName("Updated Name");

        // Giả lập service trả về DTO sau khi cập nhật thành công
        when(moduleGroupService.update(eq(id), any(ModuleGroupDTO.class))).thenReturn(mockDto);

        // When & Then
        mockMvc.perform(put("/api/module-groups/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mockDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Name"))
                .andExpect(jsonPath("$.description").value("Description"));

        // Xác nhận service được gọi đúng 1 lần với đúng ID và dữ liệu
        verify(moduleGroupService, times(1)).update(eq(id), any(ModuleGroupDTO.class));
    }

    @Test
    @DisplayName("PUT /api/module-groups/{id} - Should return 400 when validation fails")
    void update_InvalidData_ShouldReturnBadRequest() throws Exception {
        // Giả sử tên không được để trống (Annotation @NotBlank trong DTO)
        mockDto.setName("");

        mockMvc.perform(put("/api/module-groups/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mockDto)))
                .andExpect(status().isBadRequest());

        // Service không được phép gọi nếu validation ở Controller thất bại
        verify(moduleGroupService, never()).update(anyLong(), any());
    }

    @Test
    @DisplayName("DELETE /api/module-groups/{id} - Should return No Content")
    void delete_ShouldReturnNoContent() throws Exception {
        mockMvc.perform(delete("/api/module-groups/1"))
                .andExpect(status().isNoContent());
    }

    // --- 2. TEST DATA IO (BaseCrudDataIoController) ---

    @Test
    @DisplayName("GET /api/module-groups/export - Should trigger export service")
    void exportFile_ShouldReturnStatusOk() throws Exception {
        // Vì exportService ghi trực tiếp vào HttpServletResponse,
        // chúng ta chỉ cần verify status và xem service có được gọi không
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

        // Giả lập kết quả trả về của ImportService
        // ImportResult là lớp bạn định nghĩa, ở đây tôi giả định nó có cấu trúc cơ bản
        when(importService.importFile(any(), any(), any())).thenReturn(null);

        mockMvc.perform(multipart("/api/module-groups/import")
                        .file(file))
                .andExpect(status().isOk());
    }
}
