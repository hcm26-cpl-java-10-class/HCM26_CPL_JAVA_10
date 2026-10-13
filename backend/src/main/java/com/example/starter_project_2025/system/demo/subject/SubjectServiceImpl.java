package com.example.starter_project_2025.system.demo.subject;

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
        return new String[]{"code", "name"};
    }

    @Override
    protected void beforeCreate(Subject entity, SubjectDTO request, ValidationContext ctx) {
        if (subjectRepository.existsByCode(entity.getCode())) {
            ctx.add("code", "Subject code already exists");
        }
    }
}
