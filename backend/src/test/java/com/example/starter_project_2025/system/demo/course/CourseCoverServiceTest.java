package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.upload.FileStorageService;
import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import static org.junit.jupiter.api.Assertions.*;

class CourseCoverServiceTest {
    @TempDir Path directory;
    @Test void generatesApprovedPngAndPreservesCoverAndMetadataOnRetries() throws Exception {
        var service = new CourseCoverService(new FileStorageService(directory.toString()));
        Course course = Course.builder().name("Lập trình nâng cao — "+"Tiếng Việt ".repeat(10)).level(CourseLevel.ADVANCED)
            .categories(Set.of(Category.builder().code("JAVA").name("Java").build())).status(CourseStatus.DRAFT).build();
        service.ensureCover(course);
        String url = course.getThumbnailUrl(); assertTrue(url.startsWith("http://localhost:8080/uploads/course-cover-"));
        try(var files = Files.list(directory)) {
            Path file = files.findFirst().orElseThrow();var image = ImageIO.read(file.toFile());
            assertEquals(1200,image.getWidth());assertEquals(630,image.getHeight());
        }
        service.ensureCover(course);assertEquals(url,course.getThumbnailUrl());
        try(var files=Files.list(directory)) {assertEquals(1,files.count());}
        assertEquals(CourseStatus.DRAFT,course.getStatus());assertEquals(CourseLevel.ADVANCED,course.getLevel());
        course.setThumbnailUrl("https://example.test/manual.jpg");service.ensureCover(course);
        assertEquals("https://example.test/manual.jpg",course.getThumbnailUrl());
    }
    @Test void replacementCleanupRetainsSharedImagesAndIgnoresUnmanagedFiles() throws Exception {
        var storage=new FileStorageService(directory.toString());
        var service=new CourseCoverService(storage);
        Course course=Course.builder().name("Shared").build();service.ensureCover(course);
        String name=course.getThumbnailUrl().substring(course.getThumbnailUrl().lastIndexOf('/')+1);
        storage.removeUnreferencedCourseImage(name,()->true);assertTrue(Files.exists(directory.resolve(name)));
        Files.writeString(directory.resolve("manual.png"),"user image");
        storage.removeUnreferencedCourseImage("manual.png",()->false);assertTrue(Files.exists(directory.resolve("manual.png")));
        storage.removeUnreferencedCourseImage(name,()->false);assertFalse(Files.exists(directory.resolve(name)));
    }
    @Test void invalidSelectedImagePreservesPreviousCover() {
        var service = new CourseCoverService(new FileStorageService(directory.toString()));
        Course course=Course.builder().name("Existing").thumbnailUrl("https://example.test/previous.png").coverImage("data:image/png;base64,YmFk").build();
        assertThrows(BadRequestException.class,()->service.ensureCover(course));
        assertEquals("https://example.test/previous.png",course.getThumbnailUrl());
    }
    @Test void rollbackRemovesNewFilesButPreservesExistingFiles() throws Exception {
        var service = new CourseCoverService(new FileStorageService(directory.toString()));
        service.ensureCover(Course.builder().name("Committed").build());
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.ensureCover(Course.builder().name("Rolled back").build());
            service.ensureCover(Course.builder().name("Committed").build());
            for(var sync:TransactionSynchronizationManager.getSynchronizations())sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
        } finally {TransactionSynchronizationManager.clearSynchronization();}
        try(var files=Files.list(directory)){assertEquals(1,files.count());}
    }
}
