package com.example.starter_project_2025.system.demo.lesson;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LessonDocumentControllerTest {

    @TempDir
    Path directory;

    @Test
    void uploadsSupportedDocumentAndRejectsUnsupportedFile() {
        LessonDocumentController controller = new LessonDocumentController(
                directory.toString(), "http://localhost:8080"
        );

        var response = controller.upload(new MockMultipartFile(
                "file", "lesson.pdf", "application/pdf", "%PDF-1.4".getBytes()
        ));
        assertThat(response.url()).startsWith("http://localhost:8080/api/lesson-documents/").endsWith(".pdf");

        assertThatThrownBy(() -> controller.upload(new MockMultipartFile(
                "file", "script.exe", "application/octet-stream", new byte[]{1}
        ))).isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Supported document formats");
    }
}
