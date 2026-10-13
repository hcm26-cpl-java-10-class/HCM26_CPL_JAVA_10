package com.example.starter_project_2025.system.subject;

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
public class SubjectServiceImpl
        extends BaseCrudServiceImpl<Subject, Long, SubjectDTO, SubjectFilter>
        implements SubjectService {

    SubjectMapper subjectMapper;
    SubjectRepository subjectRepository;

    @Override
    protected BaseCrudRepository<Subject, Long> getRepository() {
        return subjectRepository;
    }

    @Override
    protected BaseCrudMapper<Subject, SubjectDTO> getMapper() {
        return subjectMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"code", "name", "description", "technicalGroup"};
    }

    @Override
    protected void beforeCreate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        if (request.getCode() == null || request.getCode().trim().isEmpty()) {
            ctx.add("code", "Mã môn học không được để trống");
        } else {
            request.setCode(request.getCode().trim().toUpperCase());
        }

        if (request.getName() == null || request.getName().trim().isEmpty()) {
            ctx.add("name", "Tên môn học không được để trống");
        }

        if (request.getVersion() == null || request.getVersion().trim().isEmpty()) {
            request.setVersion("1.0");
        }

        if (request.getStatus() == null) {
            request.setStatus(SubjectStatus.ACTIVE);
        }
    }

    @Override
    protected void beforeUpdate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        if (request.getCode() != null) {
            request.setCode(request.getCode().trim().toUpperCase());
        }
    }
}
