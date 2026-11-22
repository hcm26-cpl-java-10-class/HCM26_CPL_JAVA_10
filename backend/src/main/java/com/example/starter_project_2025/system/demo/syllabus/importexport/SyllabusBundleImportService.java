
package com.example.starter_project_2025.system.demo.syllabus.importexport;

import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusModels.*;
import static com.example.starter_project_2025.system.demo.syllabus.importexport.SyllabusWorkbookReader.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusClo;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusCloRepository;
import com.example.starter_project_2025.system.demo.syllabus.service.SyllabusMaterialService;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.service.SyllabusService;
import com.example.starter_project_2025.system.demo.syllabus.service.SyllabusWorkflowService;

@Service
@RequiredArgsConstructor
public class SyllabusBundleImportService {

    private final SyllabusService syllabusService;
    private final SyllabusRepository syllabusRepository;
    private final SyllabusCloRepository cloRepository;
    private final SyllabusMaterialService materialService;
    private final SyllabusWorkflowService workflow;

    @Value("${app.syllabus.demo-import-enabled:false}")
    private boolean enabled;

    public record ImportSummary(
            int syllabuses,
            int clos,
            int sections,
            int topics,
            int materials
    ) {
    }

    // =========================================
    // IMPORT ENTRY POINT
    // =========================================

    @Transactional
    public ImportSummary importExcel(MultipartFile file) {

        // Keep the existing demo-import restriction.
        if (!enabled) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Demo import is disabled"
            );
        }

        // Validate the uploaded file.
        if (file == null
                || file.isEmpty()
                || file.getSize() > 5_000_000
                || file.getOriginalFilename() == null
                || !file.getOriginalFilename()
                .toLowerCase(Locale.ROOT)
                .endsWith(".xlsx")) {

            throw bad(
                    "Choose a .xlsx file smaller than 5 MB"
            );
        }

        try (Workbook workbook =
                     WorkbookFactory.create(file.getInputStream())) {

            // Only four academic programme sheets are required.
            Sheet syllabusSheet =
                    requiredSheet(workbook, "Syllabuses");

            Sheet cloSheet =
                    requiredSheet(workbook, "CLOs");

            Sheet sectionSheet =
                    requiredSheet(workbook, "Sections");

            Sheet topicSheet =
                    requiredSheet(workbook, "Topics");

            // Import in dependency order.
            int syllabusCount =
                    importSyllabuses(syllabusSheet);

            int cloCount =
                    importClos(cloSheet);

            int sectionCount =
                    importSections(sectionSheet);

            int topicCount =
                    importTopics(topicSheet);

            // Accept older five-sheet Excel files without importing legacy Syllabus
            // material records. The fifth sheet is safely ignored.
            int materialCount = 0;

            // NEW:
            // Do not report an empty template as a
            // successful import.
            int totalImported =
                    syllabusCount
                            + cloCount
                            + sectionCount
                            + topicCount
                            + materialCount;

            if (totalImported == 0) {
                throw bad(
                        "Excel file does not contain any data to import"
                );
            }

            return new ImportSummary(
                    syllabusCount,
                    cloCount,
                    sectionCount,
                    topicCount,
                    materialCount
            );

        } catch (IOException exception) {
            throw bad("Cannot read Excel file");

        } catch (ResponseStatusException exception) {
            throw exception;

        } catch (Exception exception) {
            throw bad(
                    "Import failed: " + exception.getMessage()
            );
        }
    }

    // =========================================
    // VALIDATION HELPERS
    // =========================================

    private static ResponseStatusException bad(
            String message
    ) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }


    // Keep the demo-only code rule.
    private static void checkDemoCode(
            String code
    ) {
        if (code == null
                || !code.matches(
                "DEMO-[A-Z0-9_-]{3,25}"
        )) {

            throw bad(
                    "Only DEMO-* syllabus codes are allowed"
            );
        }
    }

    private static String normalize(
            String text
    ) {
        return text.strip()
                .replaceAll("(?U)\\s+", " ")
                .toLowerCase(Locale.ROOT);
    }

    @FunctionalInterface
    private interface RowImporter {
        void apply(
                Row row,
                Map<String, Integer> headers
        );
    }

    // Process non-empty data rows.
    private static int each(
            Sheet sheet,
            String[] requiredHeaders,
            RowImporter importer
    ) {
        Map<String, Integer> columns =
                headers(
                        sheet,
                        requiredHeaders
                );

        DataFormatter formatter =
                new DataFormatter();

        int processed = 0;

        for (
                int i = 1;
                i <= sheet.getLastRowNum();
                i++
        ) {
            Row row = sheet.getRow(i);

            if (row == null) {
                continue;
            }

            boolean empty = true;

            for (Cell cell : row) {
                if (!formatter
                        .formatCellValue(cell)
                        .isBlank()) {

                    empty = false;
                    break;
                }
            }

            if (empty) {
                continue;
            }

            try {
                importer.apply(
                        row,
                        columns
                );

                processed++;

            } catch (Exception exception) {
                throw bad(
                        sheet.getSheetName()
                                + " row "
                                + (i + 1)
                                + ": "
                                + exception.getMessage()
                );
            }
        }

        return processed;
    }

    // =========================================
    // FIND HELPERS
    // =========================================

    private Summary findSyllabus(
            String rawCode
    ) {
        String code = rawCode
                .strip()
                .toUpperCase(Locale.ROOT);

        checkDemoCode(code);

        return syllabusService.list("")
                .stream()
                .filter(item ->
                        item.code()
                                .equalsIgnoreCase(code)
                )
                .findFirst()
                .orElseThrow(
                        () -> bad(
                                "Unknown syllabus: " + code
                        )
                );
    }

    // All related content must be imported
    // into a Draft syllabus only.
    private long syllabusId(
            String code
    ) {
        Summary syllabus =
                findSyllabus(code);

        workflow.requireDraft(
                syllabus.id()
        );

        return syllabus.id();
    }

    private SectionView findSection(
            long syllabusId,
            String title
    ) {
        return syllabusService.get(syllabusId)
                .sections()
                .stream()
                .filter(item ->
                        normalize(item.title())
                                .equals(
                                        normalize(title)
                                )
                )
                .findFirst()
                .orElseThrow(
                        () -> bad(
                                "Unknown section: " + title
                        )
                );
    }

    private TopicView findTopic(
            long syllabusId,
            String sectionTitle,
            String topicTitle
    ) {
        return findSection(
                syllabusId,
                sectionTitle
        )
                .topics()
                .stream()
                .filter(item ->
                        normalize(item.title())
                                .equals(
                                        normalize(topicTitle)
                                )
                )
                .findFirst()
                .orElseThrow(
                        () -> bad(
                                "Unknown topic: " + topicTitle
                        )
                );
    }

    // =========================================
    // 1. IMPORT SYLLABUSES
    // =========================================

    private int importSyllabuses(
            Sheet sheet
    ) {
        return each(
                sheet,
                new String[]{
                        "Code",
                        "Name",
                        "Description"
                },
                (row, headers) -> {

                    String code = required(
                            row,
                            headers,
                            "Code"
                    ).toUpperCase(Locale.ROOT);

                    checkDemoCode(code);

                    String name = required(
                            row,
                            headers,
                            "Name"
                    );

                    String description = value(
                            row,
                            headers,
                            "Description"
                    );

                    Summary existing =
                            syllabusService.list("")
                                    .stream()
                                    .filter(item ->
                                            item.code()
                                                    .equalsIgnoreCase(code)
                                    )
                                    .findFirst()
                                    .orElse(null);

                    long id;

                    if (existing == null) {
                        id = syllabusService.create(
                                new SyllabusInput(
                                        code,
                                        name,
                                        description
                                )
                        ).id();

                    } else {
                        // Never update Published.
                        workflow.requireDraft(
                                existing.id()
                        );

                        id = syllabusService.update(
                                existing.id(),
                                new SyllabusInput(
                                        code,
                                        name,
                                        description
                                )
                        ).id();
                    }

                    syllabusService.updateInformation(
                            id,
                            new InformationInput(
                                    code,
                                    name,
                                    description,
                                    value(
                                            row,
                                            headers,
                                            "Teaching Methods"
                                    ),
                                    value(
                                            row,
                                            headers,
                                            "Degree Level"
                                    ),
                                    value(
                                            row,
                                            headers,
                                            "Time Allocation"
                                    ),
                                    value(
                                            row,
                                            headers,
                                            "Student Responsibilities"
                                    ),
                                    value(
                                            row,
                                            headers,
                                            "Required Tools"
                                    ),
                                    number(
                                            row,
                                            headers,
                                            "Scoring Scale",
                                            true
                                    )
                            )
                    );
                }
        );
    }

    // =========================================
    // 2. IMPORT CLOs
    // =========================================

    private int importClos(
            Sheet sheet
    ) {
        return each(
                sheet,
                new String[]{
                        "Syllabus Code",
                        "CLO Code",
                        "Details",
                        "Order Index"
                },
                (row, headers) -> {

                    long id = syllabusId(
                            required(
                                    row,
                                    headers,
                                    "Syllabus Code"
                            )
                    );

                    String code = required(
                            row,
                            headers,
                            "CLO Code"
                    ).toUpperCase(Locale.ROOT);

                    String details = required(
                            row,
                            headers,
                            "Details"
                    );

                    int order = number(
                            row,
                            headers,
                            "Order Index",
                            false
                    );

                    if (
                            !code.matches(
                                    "CLO[1-9][0-9]*"
                            )
                                    || code.length() > 20
                                    || order < 0
                                    || details.length() < 10
                                    || details.length() > 2000
                    ) {
                        throw bad("Invalid CLO data");
                    }

                    SyllabusClo clo =
                            cloRepository
                                    .findBySyllabus_IdOrderByOrderIndexAsc(
                                            id
                                    )
                                    .stream()
                                    .filter(item ->
                                            item.getCode()
                                                    .equalsIgnoreCase(code)
                                    )
                                    .findFirst()
                                    .orElseGet(
                                            SyllabusClo::new
                                    );

                    if (clo.getId() == null) {
                        clo.setSyllabus(
                                syllabusRepository
                                        .getReferenceById(id)
                        );
                    }

                    clo.setCode(code);
                    clo.setDetails(details);
                    clo.setOrderIndex(order);

                    // Draft was verified above.
                    cloRepository.saveAndFlush(clo);
                }
        );
    }

    // =========================================
    // 3. IMPORT SECTIONS / MISSIONS
    // =========================================

    private int importSections(
            Sheet sheet
    ) {
        return each(
                sheet,
                new String[]{
                        "Syllabus Code",
                        "Section Title",
                        "Order Index",
                        "Mission"
                },
                (row, headers) -> {

                    long id = syllabusId(
                            required(
                                    row,
                                    headers,
                                    "Syllabus Code"
                            )
                    );

                    String title = required(
                            row,
                            headers,
                            "Section Title"
                    );

                    int order = number(
                            row,
                            headers,
                            "Order Index",
                            false
                    );

                    String mission = value(
                            row,
                            headers,
                            "Mission"
                    );

                    SectionView existing =
                            syllabusService.get(id)
                                    .sections()
                                    .stream()
                                    .filter(item ->
                                            normalize(
                                                    item.title()
                                            ).equals(
                                                    normalize(title)
                                            )
                                    )
                                    .findFirst()
                                    .orElse(null);

                    SectionInput input =
                            new SectionInput(
                                    title,
                                    order,
                                    mission
                            );

                    if (existing == null) {
                        syllabusService.createSection(
                                id,
                                input
                        );

                    } else {
                        syllabusService.updateSection(
                                id,
                                existing.id(),
                                input
                        );
                    }
                }
        );
    }

    // =========================================
    // 4. IMPORT TOPICS
    // =========================================

    private int importTopics(
            Sheet sheet
    ) {
        return each(
                sheet,
                new String[]{
                        "Syllabus Code",
                        "Section Title",
                        "Topic Title",
                        "Order Index"
                },
                (row, headers) -> {

                    long id = syllabusId(
                            required(
                                    row,
                                    headers,
                                    "Syllabus Code"
                            )
                    );

                    SectionView section = findSection(
                            id,
                            required(
                                    row,
                                    headers,
                                    "Section Title"
                            )
                    );

                    String title = required(
                            row,
                            headers,
                            "Topic Title"
                    );

                    int order = number(
                            row,
                            headers,
                            "Order Index",
                            false
                    );

                    TopicView existing =
                            section.topics()
                                    .stream()
                                    .filter(item ->
                                            normalize(
                                                    item.title()
                                            ).equals(
                                                    normalize(title)
                                            )
                                    )
                                    .findFirst()
                                    .orElse(null);

                    TopicInput input =
                            new TopicInput(
                                    title,
                                    order
                            );

                    if (existing == null) {
                        syllabusService.createTopic(
                                id,
                                section.id(),
                                input
                        );

                    } else {
                        syllabusService.updateTopic(
                                id,
                                section.id(),
                                existing.id(),
                                input
                        );
                    }
                }
        );
    }

    // =========================================
    // 5. IMPORT LEARNING MATERIALS
    // =========================================

    private int importMaterials(
            Sheet sheet
    ) {
        return each(
                sheet,
                new String[]{
                        "Syllabus Code",
                        "Section Title",
                        "Topic Title",
                        "Title",
                        "Type",
                        "URL",
                        "Author",
                        "Publisher",
                        "Main Material",
                        "Note"
                },
                (row, headers) -> {

                    long id = syllabusId(
                            required(
                                    row,
                                    headers,
                                    "Syllabus Code"
                            )
                    );

                    String sectionTitle = value(
                            row,
                            headers,
                            "Section Title"
                    );

                    String topicTitle = value(
                            row,
                            headers,
                            "Topic Title"
                    );

                    Long topicId = null;

                    if (!topicTitle.isBlank()) {
                        if (sectionTitle.isBlank()) {
                            throw bad(
                                    "Section Title is required for a linked Topic"
                            );
                        }

                        topicId = findTopic(
                                id,
                                sectionTitle,
                                topicTitle
                        ).id();
                    }

                    String url = required(
                            row,
                            headers,
                            "URL"
                    );

                    String type = required(
                            row,
                            headers,
                            "Type"
                    );

                    SyllabusMaterialService.MaterialInput input =
                            new SyllabusMaterialService.MaterialInput(
                                    required(
                                            row,
                                            headers,
                                            "Title"
                                    ),
                                    type,
                                    url,
                                    value(
                                            row,
                                            headers,
                                            "Author"
                                    ),
                                    value(
                                            row,
                                            headers,
                                            "Publisher"
                                    ),
                                    yes(
                                            row,
                                            headers,
                                            "Main Material"
                                    ),
                                    value(
                                            row,
                                            headers,
                                            "Note"
                                    ),
                                    topicId
                            );

                    final Long linkedTopicId = topicId;

                    List<SyllabusMaterialService.MaterialView> existingList =
                            materialService.list(id);

                    SyllabusMaterialService.MaterialView existing =
                            existingList.stream()
                                    .filter(item ->
                                            item.url()
                                                    .equalsIgnoreCase(url)
                                                    && Objects.equals(
                                                    item.topicId(),
                                                    linkedTopicId
                                            )
                                    )
                                    .findFirst()
                                    .orElse(null);

                    if (existing == null) {
                        materialService.create(
                                id,
                                input
                        );

                    } else {
                        materialService.update(
                                id,
                                existing.id(),
                                input
                        );
                    }
                }
        );
    }
}
