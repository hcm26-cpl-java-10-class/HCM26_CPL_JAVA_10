package com.example.starter_project_2025.system.menu.module_groups;

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
@RequestMapping("/api/module-groups")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Module Group", description = "APIs for managing module groups")
public class ModuleGroupController
        extends BaseCrudDataIoController<ModuleGroup, Long, ModuleGroupDTO, ModuleGroupFilter> {

    ModuleGroupService moduleGroupService;
    ModuleGroupRepository moduleGroupsRepository;

    @Override
    protected BaseCrudService<Long, ModuleGroupDTO, ModuleGroupFilter> getService() {
        return moduleGroupService;
    }

    @Override
    protected BaseCrudRepository<ModuleGroup, Long> getRepository() {
        return moduleGroupsRepository;
    }

    @Override
    protected Class<ModuleGroup> getEntityClass() {
        return ModuleGroup.class;
    }
}