package com.example.starter_project_2025.system.upload;

import com.example.starter_project_2025.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final long MAX_BYTES = 2L * 1024 * 1024;
    private static final Map<String, String> EXTENSION_BY_TYPE = Map.of(
            "image/png", "png",
            "image/jpeg", "jpg",
            "image/gif", "gif",
            "image/webp", "webp");

    private final Path root;
    private final java.util.concurrent.locks.ReentrantLock coverLock = new java.util.concurrent.locks.ReentrantLock();
    @Value("${app.backend-domain:http://localhost:8080}")
    private String backendDomain = "http://localhost:8080";

    /** Content-addressed files make retries idempotent. Rollbacks remove only newly created files. */
    public String storeCourseImage(byte[] bytes) {
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new BadRequestException("Image must be 2 MB or smaller");
        byte[] png;
        try (var input = javax.imageio.ImageIO.createImageInputStream(new java.io.ByteArrayInputStream(bytes))) {
            var readers = javax.imageio.ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new BadRequestException("The selected image could not be decoded. Try PNG or JPEG.");
            var reader = readers.next();
            try {
                reader.setInput(input);
                if ((long)reader.getWidth(0) * reader.getHeight(0) > 16_000_000L)
                    throw new BadRequestException("Cover dimensions are too large");
                var image = reader.read(0);
                var output = new java.io.ByteArrayOutputStream();
                javax.imageio.ImageIO.write(image, "png", output); png = output.toByteArray();
                if (png.length > MAX_BYTES) throw new BadRequestException("Converted cover must be 2 MB or smaller");
            } finally { reader.dispose(); }
        } catch (IOException e) { throw new BadRequestException("Could not read the selected cover"); }
        // ponytail: serialize cover writes through transaction completion; use per-hash locks if volume grows.
        coverLock.lock();
        boolean registered = false;
        try {
            String hash = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(png));
            Path target = root.resolve("course-cover-" + hash + ".png");
            Files.createDirectories(root);
            boolean created = !Files.exists(target);
            if (created) Files.write(target, png, java.nio.file.StandardOpenOption.CREATE_NEW);
            if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
                org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override public void afterCompletion(int status) {
                            try {
                                if (created && status != STATUS_COMMITTED) Files.deleteIfExists(target);
                            } catch (IOException e) { org.slf4j.LoggerFactory.getLogger(FileStorageService.class).error("Could not remove rolled-back course cover",e); }
                            finally { coverLock.unlock(); }
                        }
                    });
                registered = true;
            }
            String base = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes() == null
                ? backendDomain : ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
            return base.replaceAll("/+$", "") + "/uploads/" + target.getFileName();
        } catch (IOException | java.security.NoSuchAlgorithmException e) { throw new IllegalStateException("Could not store the course cover",e); }
        finally { if (!registered) coverLock.unlock(); }
    }

    public FileStorageService(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.root = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    public void removeUnreferencedCourseImage(String name, java.util.function.BooleanSupplier referenced) {
        if (!name.matches("course-cover-[a-f0-9]{64}\\.png")) return;
        coverLock.lock();
        try {
            if (!referenced.getAsBoolean()) Files.deleteIfExists(root.resolve(name));
        } catch (IOException e) { throw new IllegalStateException("Could not remove replaced course cover",e); }
        finally { coverLock.unlock(); }
    }

    public String storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file was uploaded");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BadRequestException("Image must be 2 MB or smaller");
        }
        String extension = EXTENSION_BY_TYPE.get(file.getContentType());
        if (extension == null) {
            throw new BadRequestException("Only PNG, JPEG, GIF or WebP images are allowed");
        }

        String fileName = UUID.randomUUID() + "." + extension;
        try {
            Files.createDirectories(root);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, root.resolve(fileName).normalize(), StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new RuntimeException("Could not store the image", e);
        }
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/uploads/").path(fileName).toUriString();
    }
}