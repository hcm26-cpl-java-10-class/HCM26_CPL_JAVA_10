package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.zip.ZipInputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyllabusMaterialsArchiveServiceTest {
    @Mock StudentSyllabusCatalogService catalog;
    @Mock SyllabusMaterialFileService files;
    @InjectMocks SyllabusMaterialsArchiveService service;
    @TempDir Path temp;

    private StudentSyllabusCatalogService.Detail detail(String url) {
        return new StudentSyllabusCatalogService.Detail(5L, "NET101", "Network Fundamentals", "",
                "", "", "", "", "", 10,
                List.of(new StudentSyllabusCatalogService.SectionView(3L, "Network Section", 1, "Describe networks",
                        List.of(new StudentSyllabusCatalogService.TopicView(9L, "Network Models", 1, List.of(7L))))),
                List.of(new StudentSyllabusCatalogService.CloView(7L, "CLO1", "Networking basics", 1)),
                List.of(new StudentSyllabusCatalogService.MaterialView(17L, "Reference", "LINK", url,
                        null, null, true, null, 9L)));
    }

    private Map<String, byte[]> unzip(byte[] bytes) throws Exception {
        Map<String, byte[]> out = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                out.put(entry.getName(), zip.readAllBytes());
            }
        }
        return out;
    }

    @Test
    void externalLinksBecomeShortcutsAndPlanCsvNotFakePowerpoints() throws Exception {
        when(catalog.detail(5L)).thenReturn(detail("https://example.org/CHAPTER_1.pptx"));
        var result = service.export(5L);
        assertEquals("NET101_student_materials.zip", result.fileName());
        Map<String, byte[]> entries = unzip(result.bytes());
        assertTrue(entries.keySet().stream().anyMatch(path -> path.endsWith(".url")));
        assertFalse(entries.keySet().stream().anyMatch(path -> path.endsWith(".pptx")));
        assertTrue(entries.keySet().stream().anyMatch(path -> path.endsWith("Learning-Plan.csv")));
        String readme = new String(entries.get("NET101/README.txt"), StandardCharsets.UTF_8);
        assertTrue(readme.contains("External references: 1"));
        assertTrue(entries.keySet().stream().noneMatch(name -> name.contains("../")));
    }

    @Test
    void localUploadIsPackedAsRealPptx() throws Exception {
        String key = "123e4567-e89b-12d3-a456-426614174000_CHAPTER_1.pptx";
        String url = "http://localhost:8080/api/student/syllabuses/5/material-files/" + key;
        Path ppt = temp.resolve("CHAPTER_1.pptx");
        byte[] content = {0x50, 0x4b, 0x03, 0x04};
        Files.write(ppt, content);
        when(catalog.detail(5L)).thenReturn(detail(url));
        when(files.keyFromUrl(5L, url)).thenReturn(key);
        when(files.existingFile(5L, key)).thenReturn(ppt);
        when(files.displayFileName(key)).thenReturn("CHAPTER_1.pptx");
        Map<String, byte[]> entries = unzip(service.export(5L).bytes());
        byte[] packed = entries.entrySet().stream().filter(e -> e.getKey().endsWith(".pptx"))
                .findFirst().orElseThrow().getValue();
        assertArrayEquals(content, packed);
    }

    @Test
    void rejectsDraftThroughCatalogAuthorizationCheck() {
        when(catalog.detail(5L)).thenThrow(new ResourceNotFoundException("Published Syllabus not found"));
        assertThrows(ResourceNotFoundException.class, () -> service.export(5L));
        verifyNoInteractions(files);
    }
}
