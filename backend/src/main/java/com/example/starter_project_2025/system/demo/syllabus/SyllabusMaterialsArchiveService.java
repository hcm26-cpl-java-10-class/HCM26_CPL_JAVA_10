package com.example.starter_project_2025.system.demo.syllabus;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Exports a learning plan and locally stored files. External links become .url shortcuts, not fake PPTX files. */
@Service
@RequiredArgsConstructor
public class SyllabusMaterialsArchiveService {
    private static final int MAX_ITEMS = 500;
    private static final long MAX_TOTAL = 100L * 1024 * 1024;

    private final StudentSyllabusCatalogService catalog;
    private final SyllabusMaterialFileService fileService;

    public record Export(String fileName, byte[] bytes) {}

    public Export export(Long id) throws IOException {
        var detail = catalog.detail(id); // Reject Draft/inactive before reading anything.
        if (detail.materials().size() > MAX_ITEMS) {
            throw new IllegalStateException("Too many materials to export");
        }
        String root = cleanName(detail.code()) + "/";
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        long[] totalBytes = {0L};
        List<String> csv = new ArrayList<>();
        csv.add("Section,Topic,CLOs,Mission,Material,Type,URL");
        int localCount = 0;
        int linkCount = 0;

        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            Map<Long, StudentSyllabusCatalogService.CloView> cloMap = new HashMap<>();
            for (var clo : detail.clos()) cloMap.put(clo.id(), clo);
            Set<Long> exported = new HashSet<>();
            int sectionIndex = 0;

            for (var section : detail.sections()) {
                sectionIndex++;
                String sectionDir = root + "Section_" + pad(sectionIndex) + "_" + cleanName(section.title()) + "/";
                int topicIndex = 0;
                for (var topic : section.topics()) {
                    topicIndex++;
                    String topicDir = sectionDir + "Topic_" + pad(topicIndex) + "_" + cleanName(topic.title()) + "/";
                    String cloCodes = topic.cloIds().stream().map(cloMap::get)
                            .filter(Objects::nonNull).map(StudentSyllabusCatalogService.CloView::code)
                            .distinct().reduce((a, b) -> a + ", " + b).orElse("");
                    put(zip, topicDir + "Learning-Outcomes.txt", ("Topic: " + topic.title() + "\nCLOs: " + cloCodes
                            + "\nMission: " + safeText(section.mission()) + "\n").getBytes(StandardCharsets.UTF_8));
                    for (var material : detail.materials()) {
                        if (!Objects.equals(material.topicId(), topic.id())) continue;
                        exported.add(material.id());
                        csv.add(row(section.title(), topic.title(), cloCodes, section.mission(), material));
                        if (addMaterial(zip, topicDir, material, id, totalBytes)) localCount++; else linkCount++;
                    }
                }
            }
            String sharedDir = root + "Shared-Resources/";
            for (var material : detail.materials()) {
                if (exported.contains(material.id())) continue;
                csv.add(row("Shared", "", "", "", material));
                if (addMaterial(zip, sharedDir, material, id, totalBytes)) localCount++; else linkCount++;
            }
            put(zip, root + "Learning-Plan.csv", ("\uFEFF" + String.join("\r\n", csv) + "\r\n")
                    .getBytes(StandardCharsets.UTF_8));
            String readme = "SYLLABUS: " + detail.name() + " (" + detail.code() + ")\n\n"
                    + "ZIP contents are organized by Section and Topic.\n"
                    + "Uploaded files are included as actual documents.\n"
                    + "External links are saved as Windows .url shortcuts; internet may be required.\n"
                    + "Learning-Plan.csv contains the structured plan for Excel.\n"
                    + "Available uploaded files: " + localCount + "\nExternal references: " + linkCount + "\n"
                    + "Shared references are in Shared-Resources; no duplicate copies.\n";
            put(zip, root + "README.txt", readme.getBytes(StandardCharsets.UTF_8));
        }
        if (bytes.size() > MAX_TOTAL) throw new IllegalStateException("Archive exceeds 100 MB");
        return new Export(cleanName(detail.code()) + "_student_materials.zip", bytes.toByteArray());
    }

    /** Returns true only when actual file bytes were packed. */
    private boolean addMaterial(ZipOutputStream zip, String directory,
                                StudentSyllabusCatalogService.MaterialView material, Long syllabusId, long[] totalBytes) throws IOException {
        String prefix = String.format(Locale.ROOT, "%03d_", material.id());
        String key = fileService.keyFromUrl(syllabusId, material.url());
        if (key != null) {
            Path path = fileService.existingFile(syllabusId, key);
            if (Files.size(path) > 20L * 1024 * 1024) {
                throw new IllegalStateException("Learning file is too large");
            }
            totalBytes[0] += Files.size(path);
            if (totalBytes[0] > MAX_TOTAL) throw new IllegalStateException("Archive source files exceed 100 MB");
            put(zip, directory + prefix + cleanName(fileService.displayFileName(key)), Files.readAllBytes(path));
            return true;
        }
        String name = directory + prefix + cleanName(material.title()) + ".url";
        // .url uses INI syntax; only http(s) URLs are supported by the material model.
        String safeUrl = material.url() == null ? "" : material.url().replace("\r", "").replace("\n", "");
        put(zip, name, ("[InternetShortcut]\r\nURL=" + safeUrl + "\r\n").getBytes(StandardCharsets.UTF_8));
        return false;
    }

    private static String row(String section, String topic, String clos, String mission,
                              StudentSyllabusCatalogService.MaterialView material) {
        return String.join(",", escape(section), escape(topic), escape(clos), escape(mission),
                escape(material.title()), escape(material.type()), escape(material.url()));
    }

    private static String escape(String s) {
        String clean = safeText(s).replace("\r", " ").replace("\n", " ");
        // Avoid spreadsheet formula injection for user-provided text.
        if (!clean.isEmpty() && "=+-@\t".indexOf(clean.charAt(0)) >= 0) clean = "'" + clean;
        return "\"" + clean.replace("\"", "\"\"") + "\"";
    }

    private static String safeText(String value) { return value == null ? "" : value; }
    private static String pad(int number) { return String.format(Locale.ROOT, "%02d", number); }
    private static String cleanName(String s) {
        String clean = safeText(s).replaceAll("[\\p{Cntrl}\\\\/:*?\"<>|]", "_")
                .replaceAll("\\s+", "_").replaceAll("\\.+$", "");
        clean = clean.replaceAll("[^\\p{L}\\p{N}._-]", "_");
        if (clean.length() > 64) clean = clean.substring(0, 64);
        return clean.isBlank() ? "material" : clean;
    }
    private static void put(ZipOutputStream zip, String name, byte[] data) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(data);
        zip.closeEntry();
    }
}
