package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface CertificateMapper extends BaseCrudMapper<Certificate, CertificateDTO> {
    @Override
    @IgnoreAuditFields
    @Mapping(target = "course", ignore = true)
    @Mapping(target = "user", ignore = true)
    Certificate toEntity(CertificateDTO dto);

    @Mapping(source = "course.id", target = "courseId")
    @Mapping(source = "course.name", target = "courseName")
    @Mapping(source = "user.id", target = "userId")
    @Mapping(source = "user.firstName", target = "userFirstName")
    @Mapping(source = "user.lastName", target = "userLastName")
    CertificateDTO toResponse(Certificate entity);
}
