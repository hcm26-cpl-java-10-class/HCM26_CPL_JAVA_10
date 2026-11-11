package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.service.ExportService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SubjectExportService {
    private final SubjectService subjectService;
    private final SubjectMapper mapper;
    private final ExportService exporter;

    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    public void export(FileFormat format, String search, SubjectFilter filter, Sort sort,
                       HttpServletResponse response) throws IOException {
        var subjects = subjectService.getAll(Pageable.unpaged(sort), search, filter)
                .stream().map(mapper::toEntity).toList();
        exporter.export(format, subjects, Subject.class, response);
    }
}
