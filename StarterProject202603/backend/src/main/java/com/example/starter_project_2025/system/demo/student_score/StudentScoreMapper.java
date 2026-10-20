package com.example.starter_project_2025.system.demo.student_score;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface StudentScoreMapper extends BaseCrudMapper<StudentScore, StudentScoreDTO> {

    @Override
    @IgnoreAuditFields
    StudentScore toEntity(StudentScoreDTO dto);
}
