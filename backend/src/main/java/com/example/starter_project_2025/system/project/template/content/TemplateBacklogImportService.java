package com.example.starter_project_2025.system.project.template.content;

import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateService;
import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.template.ProjectTemplateException;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TemplateBacklogImportService {
    private final TemplateSampleContentService content;
    private final TemplateSampleContentValidator validator;
    private final ParserFactory parsers;
    private final ImportTemplateService importTemplates;
    private final TemplateBacklogImportPolicy policy;

    public byte[] template(Long id) {
        content.requireDraft(id);
        return importTemplates.generateTemplate(TemplateBacklogImportRow.class);
    }

    public List<TemplateSampleContentRequest.BacklogItem> preview(Long id, MultipartFile file) {
        content.requireDraft(id);
        if (file == null || file.isEmpty() || file.getSize() > policy.maxBytes()) {
            throw invalidFile("Choose a non-empty Excel or CSV file within the upload size limit");
        }
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase(Locale.ROOT).matches(".*\\.(csv|xlsx|xls)$")) {
            throw invalidFile("Only Excel or CSV files (.xlsx, .xls, .csv) are allowed");
        }
        List<Map<String, String>> rows;
        try (var input = file.getInputStream()) {
            rows = parsers.getParser(filename).parse(input);
        } catch (Exception exception) {
            throw invalidFile("Unable to read the file. Check that it is a valid spreadsheet with unique column names");
        }
        if (rows.isEmpty()) throw invalidFile("The file does not contain any backlog items");
        if (rows.size() > TemplateSampleContentValidator.MAX_ITEMS) {
            throw invalidFile("Import at most " + TemplateSampleContentValidator.MAX_ITEMS + " rows at a time");
        }
        Set<String> headers = new HashSet<>();
        for (String raw : rows.getFirst().keySet()) {
            String name = header(raw);
            if (!Set.of("title", "description", "suggestedrole").contains(name) || !headers.add(name)) {
                throw invalidFile("Use unique Title, Description and SuggestedRole columns");
            }
        }
        if (!headers.containsAll(Set.of("title", "suggestedrole"))) throw invalidFile("Title and SuggestedRole columns are required");
        List<TemplateSampleContentRequest.BacklogItem> items = new ArrayList<>();
        List<Integer> rowNumbers = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            Map<String, String> row = rows.get(i);
            if (row.values().stream().allMatch(value -> value == null || value.isBlank())) continue;
            Map<String, String> normalized = new HashMap<>();
            row.forEach((key, value) -> normalized.put(header(key), value == null ? "" : value.strip()));
            ProjectMemberRole role = null;
            try { role = ProjectMemberRole.valueOf(normalized.getOrDefault("suggestedrole", "").toUpperCase(Locale.ROOT)); }
            catch (IllegalArgumentException ignored) { }
            items.add(new TemplateSampleContentRequest.BacklogItem(null, normalized.get("title"), normalized.get("description"), role));
            rowNumbers.add(i + 2);
        }
        if (items.isEmpty()) throw invalidFile("The file does not contain any backlog items");
        var validation = validator.backlogErrors(items, "rows");
        Map<String, List<String>> errors = new LinkedHashMap<>();
        validation.forEach((field, messages) -> {
            int end = field.indexOf(']');
            int index = Integer.parseInt(field.substring(5, end));
            errors.put("rows[" + rowNumbers.get(index) + "]" + field.substring(end + 1), messages);
        });
        if (!errors.isEmpty()) throw new ProjectTemplateException(422, "Correct the reported rows. No items have been added", errors);
        return items;
    }

    private String header(String value) { return value.replace("\uFEFF", "").strip().toLowerCase(Locale.ROOT).replaceAll("[ _]", ""); }
    private ProjectTemplateException invalidFile(String message) { return new ProjectTemplateException(422, message, Map.of("file", List.of(message))); }
}
