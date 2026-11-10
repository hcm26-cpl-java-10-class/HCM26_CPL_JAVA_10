package com.example.starter_project_2025.system.demo.syllabus;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyllabusMaterialFileServiceTest {
    @Mock SyllabusRepository syllabuses;
    @Mock SyllabusMaterialRepository materials;
    @Mock SyllabusWorkflowService workflow;
    @InjectMocks SyllabusMaterialFileService service;
    @TempDir Path root;

    @Test
    void uploadStoresFilePrivatelyAndCopyUsesIndependentSyllabusPath() throws Exception {
        ReflectionTestUtils.setField(service, "storageDir", root.toString());
        when(syllabuses.existsById(5L)).thenReturn(true);
        var file = new MockMultipartFile("file", "CHAPTER_1.pptx",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "presentation-data".getBytes(StandardCharsets.UTF_8));
        var saved = service.upload(5L, file);
        assertTrue(saved.key().endsWith("_CHAPTER_1.pptx"));
        verify(workflow).requireDraft(5L);
        assertTrue(Files.isRegularFile(service.existingFile(5L, saved.key())));

        String oldUrl = "http://localhost:8080" + SyllabusMaterialFileService.resourcePath(5L, saved.key());
        SyllabusMaterial material = new SyllabusMaterial();
        material.setUrl(oldUrl);
        when(materials.findBySyllabus_IdOrderByIdAsc(5L)).thenReturn(List.of(material));
        String newUrl = service.copyForTemplate(5L, 6L, oldUrl);
        assertNotEquals(oldUrl, newUrl);
        String newKey = service.keyFromUrl(6L, newUrl);
        assertNotNull(newKey);
        assertArrayEquals(Files.readAllBytes(service.existingFile(5L, saved.key())),
                Files.readAllBytes(service.existingFile(6L, newKey)));
    }

    @Test
    void rejectsUnsupportedFileTypesBeforeWriting() {
        ReflectionTestUtils.setField(service, "storageDir", root.toString());
        when(syllabuses.existsById(5L)).thenReturn(true);
        var file = new MockMultipartFile("file", "tool.exe", "application/octet-stream", new byte[]{1, 2});
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> service.upload(5L, file));
        verify(workflow).requireDraft(5L);
    }
}
