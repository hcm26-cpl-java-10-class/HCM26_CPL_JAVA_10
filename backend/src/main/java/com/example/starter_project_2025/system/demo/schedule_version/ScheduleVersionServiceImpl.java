package com.example.starter_project_2025.system.demo.schedule_version;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service("legacyScheduleVersionService")
@org.springframework.context.annotation.Profile("legacy-schedule")
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ScheduleVersionServiceImpl
        extends BaseCrudServiceImpl<ScheduleVersion, Long, ScheduleVersionDTO, ScheduleVersionFilter>
        implements ScheduleVersionService {

    ScheduleVersionMapper scheduleVersionMapper;
    ScheduleVersionRepository scheduleVersionRepository;

    @Override
    protected BaseCrudRepository<ScheduleVersion, Long> getRepository() {
        return scheduleVersionRepository;
    }

    @Override
    protected BaseCrudMapper<ScheduleVersion, ScheduleVersionDTO> getMapper() {
        return scheduleVersionMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"status", "note"};
    }

    @Override
    protected void beforeCreate(ScheduleVersion entity, ScheduleVersionDTO request, ValidationContext ctx) {
        if (request.getStatus() == null || request.getStatus().isBlank()) {
            entity.setStatus("DRAFT");
        }
        if (request.getVersionNumber() == null) {
            Integer nextVersion = scheduleVersionRepository
                    .findTopByClassIdOrderByVersionNumberDesc(request.getClassId())
                    .map(v -> v.getVersionNumber() + 1)
                    .orElse(1);
            entity.setVersionNumber(nextVersion);
        }
    }

    @Override
    public ScheduleVersionDTO cloneVersion(Long id, String note) {
        ScheduleVersion source = scheduleVersionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Schedule version not found with ID: " + id));

        Integer nextVersion = scheduleVersionRepository
                .findTopByClassIdOrderByVersionNumberDesc(source.getClassId())
                .map(v -> v.getVersionNumber() + 1)
                .orElse(1);

        ScheduleVersion clone = ScheduleVersion.builder()
                .classId(source.getClassId())
                .versionNumber(nextVersion)
                .status("DRAFT")
                .note(note != null && !note.isBlank() ? note : "Cloned from v" + source.getVersionNumber())
                .build();

        ScheduleVersion saved = scheduleVersionRepository.save(clone);
        return scheduleVersionMapper.toResponse(saved);
    }

    @Override
    public ScheduleVersionDTO activateVersion(Long id) {
        ScheduleVersion target = scheduleVersionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Schedule version not found with ID: " + id));

        // Archive previous ACTIVE version if exists for this class
        scheduleVersionRepository.findByClassIdAndStatus(target.getClassId(), "ACTIVE")
                .ifPresent(activeVer -> {
                    if (!activeVer.getId().equals(target.getId())) {
                        activeVer.setStatus("ARCHIVED");
                        scheduleVersionRepository.save(activeVer);
                    }
                });

        target.setStatus("ACTIVE");
        target.setActivatedAt(LocalDateTime.now());
        ScheduleVersion saved = scheduleVersionRepository.save(target);
        return scheduleVersionMapper.toResponse(saved);
    }
}
