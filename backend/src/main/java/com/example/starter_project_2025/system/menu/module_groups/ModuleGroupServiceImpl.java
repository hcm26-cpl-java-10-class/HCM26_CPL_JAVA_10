package com.example.starter_project_2025.system.menu.module_groups;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ModuleGroupServiceImpl
        extends BaseCrudServiceImpl<ModuleGroup, Long, ModuleGroupDTO, ModuleGroupFilter>
        implements ModuleGroupService {

        ModuleGroupRepository moduleGroupsRepository;
        ModuleGroupMapper moduleGroupMapper;

        @Override
        public BaseCrudRepository<ModuleGroup, Long> getRepository() {
                return moduleGroupsRepository;
        }

        @Override
        public BaseCrudMapper<ModuleGroup, ModuleGroupDTO> getMapper() {
                return moduleGroupMapper;
        }

        @Override
        public String[] searchableFields() {
                return new String[]{"name", "description"};
        }

        @Override
        public void beforeCreate(ModuleGroup entity, ModuleGroupDTO dto, ValidationContext ctx) {

                if (moduleGroupsRepository.existsByNameIgnoreCase(dto.getName())) {
                        ctx.add("name", "Module group name already exists");
                }
        }

        @Override
        public void beforeUpdate(ModuleGroup entity, ModuleGroupDTO dto, ValidationContext ctx) {

                if (dto.getName() != null
                        && !dto.getName().equalsIgnoreCase(entity.getName())
                        && moduleGroupsRepository.existsByNameIgnoreCase(dto.getName())) {

                        ctx.add("name", "Module group name already exists");
                }
        }
}