package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface CategoryMapper extends BaseCrudMapper<Category, CategoryDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "parent", ignore = true)
    Category toEntity(CategoryDTO dto);

    @Override
    @Mapping(source = "parent.id", target = "parentId")
    @Mapping(source = "parent.name", target = "parentName")
    CategoryDTO toResponse(Category entity);
}