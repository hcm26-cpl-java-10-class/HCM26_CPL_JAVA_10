package com.example.starter_project_2025.system.demo.section;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import java.util.List;

public interface SectionService
        extends BaseCrudService<Long, SectionDTO, SectionFilter> {

    List<SectionDTO> createBulk(
            Long courseId,
            List<String> titles
    );
}