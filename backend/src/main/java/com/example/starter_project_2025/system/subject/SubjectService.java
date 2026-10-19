package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

public interface SubjectService extends BaseCrudService<Long, SubjectDTO, SubjectFilter> {
import java.util.List;

public interface SubjectService extends BaseCrudService<Long, SubjectDTO, SubjectFilter> {

    List<SubjectDTO> getActiveSubjects();

    SubjectDTO changeStatus(Long id, Boolean isActive);

    boolean isSubjectReferenced(Long id);
}
