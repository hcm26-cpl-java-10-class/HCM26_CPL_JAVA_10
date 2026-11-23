package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.system.demo.syllabus.storage.SyllabusMaterialFileService;
import com.example.starter_project_2025.system.demo.syllabus.storage.SyllabusMaterialsArchiveService;
import com.example.starter_project_2025.system.demo.syllabus.service.StudentSyllabusCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.nio.file.Files;

/** Handles material file access. Published-only student checks stay on server. */
@Service
@RequiredArgsConstructor
public class SyllabusMaterialDeliveryService {
    private final SyllabusMaterialFileService files;
    private final StudentSyllabusCatalogService catalog;
    private final SyllabusMaterialsArchiveService archives;

    public byte[] readAdmin(Long syllabusId, String fileKey) throws IOException {
        return Files.readAllBytes(files.referencedFile(syllabusId, fileKey));
    }

    public byte[] readStudent(Long syllabusId, String fileKey) throws IOException {
        catalog.detail(syllabusId); // Must be Published + Active
        return Files.readAllBytes(files.referencedFile(syllabusId, fileKey));
    }

    public SyllabusMaterialsArchiveService.Export exportStudent(Long syllabusId) throws IOException {
        return archives.export(syllabusId);
    }
}
