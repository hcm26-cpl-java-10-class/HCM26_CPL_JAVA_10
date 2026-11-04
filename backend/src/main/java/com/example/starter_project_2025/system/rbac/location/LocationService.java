package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.List;

public interface LocationService
        extends BaseCrudService<Long, LocationDTO, LocationFilter> {


    List<LocationTreeDTO> getTree();
}