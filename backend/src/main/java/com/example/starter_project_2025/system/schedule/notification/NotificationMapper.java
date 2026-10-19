package com.example.starter_project_2025.system.schedule.notification;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface NotificationMapper extends BaseCrudMapper<Notification, NotificationDTO> {

    @Override
    @IgnoreAuditFields
    Notification toEntity(NotificationDTO dto);
}