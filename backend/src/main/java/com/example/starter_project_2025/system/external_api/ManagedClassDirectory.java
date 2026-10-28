package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ManagedClassDirectory {
    private final ManagedTeachingClassRepository classes;

    public Optional<ExternalClassDTO> find(Long id) {
        return classes.findByReferenceId(id).map(this::profile);
    }

    public List<ExternalClassDTO> merge(List<ExternalClassDTO> shared, String status) {
        var result = new ArrayList<>(shared);
        var ids = new HashSet<Long>();
        shared.forEach(clazz -> ids.add(clazz.getId()));
        for (var clazz : classes.findAll()) {
            // Never silently associate a local class with an unrelated shared identity.
            if (!ids.add(clazz.getReferenceId())) throw new ExternalApiException("Class identity collision. Contact the class administrator.");
            var profile = profile(clazz);
            if (status == null || status.isBlank() || status.equalsIgnoreCase(profile.getStatus())) result.add(profile);
        }
        return List.copyOf(result);
    }

    public ExternalClassDTO profile(ManagedTeachingClass clazz) {
        return ExternalClassDTO.builder().id(clazz.getReferenceId())
                .code("CLS_" + Long.toString(clazz.getReferenceId(), 36).toUpperCase(Locale.ROOT))
                .name(clazz.getName()).startDate(clazz.getStartDate().toString()).endDate(clazz.getEndDate().toString())
                .plannedSize(clazz.getPlannedSize()).status(Boolean.TRUE.equals(clazz.getIsActive()) ? "active" : "inactive").build();
    }
}
