package com.example.starter_project_2025.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.menu.module.ModuleRepository;
import com.example.starter_project_2025.system.menu.module_groups.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ModuleGroupServiceTest {

    @Mock
    private ModuleGroupRepository moduleRepo;

    @Mock
    private ModuleGroupMapper moduleMapper;

    @Mock
    private ModuleRepository moduleRepository;

    @InjectMocks
    private ModuleGroupServiceImpl moduleGroupService;

    private ModuleGroup mockEntity;
    private ModuleGroupDTO mockDto;

    @BeforeEach
    void setUp() {
        mockEntity = ModuleGroup.builder()
                .id(1L)
                .name("System Module")
                .description("System description")
                .build();

        mockDto = new ModuleGroupDTO();
        mockDto.setName("System Module");
    }

    @Test
    @DisplayName("Should return the correct repository instance")
    void getRepository_ShouldReturnModuleRepo() {
        assertEquals(moduleRepo, moduleGroupService.getRepository());
    }

    @Test
    @DisplayName("Should return the correct mapper instance")
    void getMapper_ShouldReturnModuleMapper() {
        assertEquals(moduleMapper, moduleGroupService.getMapper());
    }

    @Test
    @DisplayName("Should return correct searchable fields")
    void searchableFields_ShouldReturnExpectedArrays() {
        String[] fields = moduleGroupService.searchableFields();
        assertArrayEquals(new String[]{"name", "description"}, fields);
    }

    @Test
    @DisplayName("beforeCreate - Should fail when name already exists")
    void beforeCreate_NameExists_AddsError() {
        ValidationContext ctx = new ValidationContext();
        when(moduleRepo.existsByNameIgnoreCase(mockDto.getName())).thenReturn(true);

        moduleGroupService.beforeCreate(mockEntity, mockDto, ctx);

        assertTrue(ctx.hasErrors());

        var errors = (java.util.List<String>) ctx.getErrors().get("name");
        assertNotNull(errors);
        assertTrue(errors.contains("Module group name already exists"));
    }

    @Test
    @DisplayName("beforeCreate - Should pass when name is unique")
    void beforeCreate_NameUnique_NoErrors() {
        ValidationContext ctx = new ValidationContext();
        when(moduleRepo.existsByNameIgnoreCase(mockDto.getName())).thenReturn(false);

        moduleGroupService.beforeCreate(mockEntity, mockDto, ctx);

        assertFalse(ctx.hasErrors());
    }

    @Test
    @DisplayName("beforeUpdate - Should fail when updating to another existing name")
    void beforeUpdate_NewNameExists_AddsError() {
        ValidationContext ctx = new ValidationContext();
        mockDto.setName("New Unique Name");
        when(moduleRepo.existsByNameIgnoreCase("New Unique Name")).thenReturn(true);

        moduleGroupService.beforeUpdate(mockEntity, mockDto, ctx);

        assertTrue(ctx.hasErrors());

        var errors = (java.util.List<String>) ctx.getErrors().get("name");
        assertNotNull(errors);
        assertTrue(errors.contains("Module group name already exists"));
    }

    @Test
    @DisplayName("beforeUpdate - Should pass when name is unchanged")
    void beforeUpdate_SameName_NoErrors() {
        ValidationContext ctx = new ValidationContext();
        mockDto.setName(mockEntity.getName());

        moduleGroupService.beforeUpdate(mockEntity, mockDto, ctx);

        assertFalse(ctx.hasErrors());
        verify(moduleRepo, never()).existsByNameIgnoreCase(anyString());
    }

    @Test
    @DisplayName("beforeUpdate - Should pass when changing to a new unique name")
    void beforeUpdate_NewNameUnique_NoErrors() {
        ValidationContext ctx = new ValidationContext();
        mockDto.setName("Brand New Name");
        when(moduleRepo.existsByNameIgnoreCase("Brand New Name")).thenReturn(false);

        moduleGroupService.beforeUpdate(mockEntity, mockDto, ctx);

        assertFalse(ctx.hasErrors());
    }

    @Test
    @DisplayName("beforeUpdate - Should pass when DTO name is null")
    void beforeUpdate_NullNameInDto_NoErrors() {
        ValidationContext ctx = new ValidationContext();
        mockDto.setName(null);

        moduleGroupService.beforeUpdate(mockEntity, mockDto, ctx);

        assertFalse(ctx.hasErrors());
        verify(moduleRepo, never()).existsByNameIgnoreCase(anyString());
    }

    @Test
    @DisplayName("beforeDelete - Should throw BadRequestException when group contains modules")
    void beforeDelete_HasModules_ThrowsBadRequestException() {
        when(moduleRepository.existsByModuleGroupId(1L)).thenReturn(true);

        BadRequestException ex = assertThrows(BadRequestException.class, () ->
                moduleGroupService.beforeDelete(mockEntity));

        assertTrue(ex.getMessage().contains("Cannot delete module group"));
        verify(moduleRepository, times(1)).existsByModuleGroupId(1L);
    }

    @Test
    @DisplayName("beforeDelete - Should pass when group does not contain modules")
    void beforeDelete_NoModules_Success() {
        when(moduleRepository.existsByModuleGroupId(1L)).thenReturn(false);

        assertDoesNotThrow(() -> moduleGroupService.beforeDelete(mockEntity));
        verify(moduleRepository, times(1)).existsByModuleGroupId(1L);
    }
}