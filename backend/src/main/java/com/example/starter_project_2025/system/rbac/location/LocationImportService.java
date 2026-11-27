package com.example.starter_project_2025.system.rbac.location;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

@Service
@RequiredArgsConstructor
public class LocationImportService {

    private final LocationRepository locationRepository;

    public record PreviewRow(int rowNumber, String code, String name, String parentCode,
                             String status, String message, boolean valid) {
        PreviewRow withMessage(String nextMessage, boolean nextValid) {
            return new PreviewRow(rowNumber, code, name, parentCode, status, nextMessage, nextValid);
        }
    }

    public record ImportPreview(int totalRows, int validRows, int invalidRows,
                                List<PreviewRow> rows) {}

    public ImportPreview preview(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Import file is required.");
        }

        Map<Integer, PreviewRow> previewByRow = new LinkedHashMap<>();
        Map<String, String> codeToParent = new HashMap<>();
        Set<String> knownCodes = new HashSet<>(
                locationRepository.findAll().stream()
                        .map(Location::getCode)
                        .filter(Objects::nonNull)
                        .map(String::trim)
                        .map(String::toUpperCase)
                        .toList()
        );
        Set<String> fileCodes = new HashSet<>();

        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Map<String, Integer> headers = new HashMap<>();
            Row header = sheet.getRow(0);
            if (header == null) {
                throw new IllegalArgumentException("The Excel file does not contain a header row.");
            }
            for (Cell cell : header) {
                headers.put(normalizeHeader(cell.getStringCellValue()), cell.getColumnIndex());
            }

            int total = 0;
            for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || isBlankRow(row)) continue;
                total++;
                int excelRow = rowIndex + 1;

                String code = text(row, headers, "code").trim().toUpperCase(Locale.ROOT);
                String name = text(row, headers, "name").trim();
                String parentCode = text(row, headers, "parent code").trim().toUpperCase(Locale.ROOT);
                String status = text(row, headers, "status").trim().toUpperCase(Locale.ROOT);
                if (status.isBlank()) status = "ACTIVE";

                List<String> errors = new ArrayList<>();
                if (code.length() < 2 || code.length() > 50
                        || !code.matches("[A-Za-z0-9._-]+")) {
                    errors.add("Code must be 2-50 characters using letters, digits, dot, underscore or hyphen.");
                }
                if (name.isBlank() || name.length() > 150) {
                    errors.add("Name is required and must not exceed 150 characters.");
                }
                if (!status.equals("ACTIVE") && !status.equals("INACTIVE")) {
                    errors.add("Status must be ACTIVE or INACTIVE.");
                }
                if (knownCodes.contains(code)) {
                    errors.add("Code already exists.");
                }
                if (!fileCodes.add(code)) {
                    errors.add("Code is duplicated within the import file.");
                }
                if (code.equals(parentCode)) {
                    errors.add("A location cannot reference itself as parent.");
                }
                codeToParent.put(code, parentCode);
                previewByRow.put(rowIndex, new PreviewRow(
                        excelRow,
                        code,
                        name,
                        parentCode,
                        status,
                        errors.isEmpty() ? "Ready to import." : String.join(" ", errors),
                        errors.isEmpty()
                ));
            }

            for (PreviewRow previewRow : previewByRow.values().stream().toList()) {
                if (!previewRow.valid() || previewRow.parentCode().isBlank()) continue;
                boolean parentInFile = fileCodes.contains(previewRow.parentCode());
                boolean parentAlreadyExists = locationRepository.findByCode(previewRow.parentCode()).isPresent();
                if (!parentInFile && !parentAlreadyExists) {
                    previewByRow.put(previewRow.rowNumber() - 1,
                            previewRow.withMessage("Parent code does not exist.", false));
                }
            }

            for (PreviewRow previewRow : previewByRow.values()) {
                if (!previewRow.valid() || previewRow.parentCode().isBlank()) continue;
                String cursorCode = previewRow.parentCode();
                Set<String> visited = new HashSet<>();
                while (!cursorCode.isBlank()) {
                    if (!visited.add(cursorCode)) {
                        previewByRow.put(previewRow.rowNumber() - 1,
                                previewRow.withMessage("Hierarchy cycle detected.",
                                        false));
                        break;
                    }
                    if (cursorCode.equals(previewRow.code())) {
                        previewByRow.put(previewRow.rowNumber() - 1,
                                previewRow.withMessage("Hierarchy cycle detected.",
                                        false));
                        break;
                    }
                    cursorCode = codeToParent.getOrDefault(cursorCode, "").toUpperCase(Locale.ROOT);
                }
            }

            List<PreviewRow> rows = previewByRow.entrySet().stream()
                    .sorted(Map.Entry.comparingByKey())
                    .map(Map.Entry::getValue)
                    .toList();
            long valid = rows.stream().filter(PreviewRow::valid).count();
            return new ImportPreview(rows.size(), (int) valid, rows.size() - (int) valid, rows);
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("Unable to read the Excel import file.");
        }
    }

    private boolean isBlankRow(Row row) {
        for (Cell cell : row) {
            if (cell != null && !cell.toString().isBlank()) return false;
        }
        return true;
    }

    private String text(Row row, Map<String, Integer> headers, String header) {
        Integer index = headers.get(header);
        if (index == null) return "";
        Cell cell = row.getCell(index);
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> new DataFormatter().formatCellValue(cell);
            case BOOLEAN -> Boolean.toString(cell.getBooleanCellValue());
            default -> "";
        };
    }

    private String normalizeHeader(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

}
