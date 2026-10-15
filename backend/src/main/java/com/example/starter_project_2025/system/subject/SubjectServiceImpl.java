package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

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
        return new String[]{"code", "name", "technicalGroup"};
    }

    @Override
    protected void beforeCreate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        if (subjectRepository.existsByCodeAndVersion(request.getCode(), request.getVersion())) {
            ctx.add("code", "Subject with code '" + request.getCode() + "' and version '" + request.getVersion() + "' already exists");
        }

        if (request.getDurationHours() != null && request.getDurationHours() <= 0) {
            ctx.add("durationHours", "Subject duration must be greater than 0");
        }
    }

    @Override
    protected void beforeUpdate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        String checkCode = request.getCode() != null ? request.getCode() : subject.getCode();
        String checkVersion = request.getVersion() != null ? request.getVersion() : subject.getVersion();

        if (subjectRepository.existsByCodeAndVersionAndIdNot(checkCode, checkVersion, subject.getId())) {
            ctx.add("code", "Subject with code '" + checkCode + "' and version '" + checkVersion + "' already exists");
        }

        if (request.getDurationHours() != null && request.getDurationHours() <= 0) {
            ctx.add("durationHours", "Subject duration must be greater than 0");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<SubjectDTO> getActiveSubjects() {
        return subjectRepository.findByIsActiveTrue()
                .stream()
                .map(subjectMapper::toResponse)
                .toList();
    }

    @Override
    public SubjectDTO changeStatus(Long id, Boolean isActive) {
        Subject subject = subjectRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Subject not found with ID: " + id));

        subject.setIsActive(Boolean.TRUE.equals(isActive));
        Subject saved = subjectRepository.save(subject);
        return subjectMapper.toResponse(saved);
    }
}
