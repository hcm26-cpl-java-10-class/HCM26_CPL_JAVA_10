package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationGraphBuilder;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationLookupEngine;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.base.dataio.importer.result.RowError;
import com.example.starter_project_2025.system.study_session.dataio.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.function.Consumer;

/** Module-local compatibility: shared import beans and parsers remain unchanged. */
@Service
public class StudySessionImportService {
    private final ParserFactory fallbackParsers;
    private final GenericImportMapper mapper;

    @Autowired
    public StudySessionImportService(ParserFactory fallbackParsers, RelationLookupEngine relations,
                                     RelationGraphBuilder graph) {
        this(fallbackParsers, new GenericImportMapper(relations, graph, new StudySessionValueConverter()));
    }

    public StudySessionImportService(ParserFactory fallbackParsers, GenericImportMapper mapper) {
        this.fallbackParsers = fallbackParsers;
        this.mapper = mapper;
    }

    public ImportResult importFile(MultipartFile file, StudySessionRepository repository,
                                   Consumer<StudySession> beforeSave) {
        var excel = new StudySessionExcelParser();
        var csv = new StudySessionCsvParser();
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("An import filename is required");
        }
        var parser = excel.supports(filename) ? excel : csv.supports(filename) ? csv
                : fallbackParsers.getParser(filename);
        ImportResult result = new ImportResult();
        try (var input = file.getInputStream()) {
            int rowNumber = 2;
            for (var row : parser.parse(input)) {
                try {
                    StudySession session = mapper.map(row, StudySession.class);
                    beforeSave.accept(session);
                    repository.save(session);
                    result.setSuccessCount(result.getSuccessCount() + 1);
                } catch (AccessDeniedException error) {
                    throw error;
                } catch (Exception error) {
                    result.getErrors().add(new RowError(rowNumber, error.getMessage()));
                    result.setFailureCount(result.getFailureCount() + 1);
                }
                rowNumber++;
            }
        } catch (AccessDeniedException error) {
            throw error;
        } catch (Exception error) {
            throw new IllegalArgumentException("Import failed: " + error.getMessage(), error);
        }
        return result;
    }
}
