package com.example.starter_project_2025.system.menu.module;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/modules")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Module", description = "APIs for managing modules")
public class ModuleController
        extends BaseCrudDataIoController<Module, Long, ModuleDTO, ModuleFilter> {

    ModuleService moduleService;
    ModuleRepository moduleRepository;

    @Override
    protected BaseCrudService<Long, ModuleDTO, ModuleFilter> getService() {
        return moduleService;
    }

    @Override
    protected BaseCrudRepository<Module, Long> getRepository() {
        return moduleRepository;
    }

    @Override
    protected Class<Module> getEntityClass() {
        return Module.class;
    }
}