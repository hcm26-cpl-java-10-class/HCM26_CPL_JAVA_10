package com.example.starter_project_2025.base.dataio.template.service;

import java.util.List;

/**
 * One column of an import template: the header the importer matches, the rules
 * shown to the user and, for fixed value lists, the dropdown options.
 *
 * @param name          header text, must equal the {@code @ImportField} name
 * @param required      whether the importer rejects a blank cell
 * @param typeLabel     human readable data type ("Văn bản", "Số nguyên" ...)
 * @param allowedValues accepted values / format, "-" when free text
 * @param note          extra explanation of the backend rule
 * @param example       valid sample value
 * @param options       dropdown values, empty when the cell is free text
 */
public record ImportTemplateColumn(
        String name,
        boolean required,
        String typeLabel,
        String allowedValues,
        String note,
        String example,
        List<String> options
) {

    public ImportTemplateColumn {
        options = options == null ? List.of() : List.copyOf(options);
    }

    public static ImportTemplateColumn text(String name,
                                            boolean required,
                                            String note,
                                            String example) {
        return new ImportTemplateColumn(name, required, "Văn bản", "-", note, example, List.of());
    }

    public static ImportTemplateColumn integer(String name,
                                               boolean required,
                                               String note,
                                               String example) {
        return new ImportTemplateColumn(name, required, "Số nguyên", "Số nguyên", note, example, List.of());
    }

    public static ImportTemplateColumn decimal(String name,
                                               boolean required,
                                               String note,
                                               String example) {
        return new ImportTemplateColumn(name, required, "Số thực", "Số thực", note, example, List.of());
    }

    public static ImportTemplateColumn dateTime(String name,
                                                boolean required,
                                                String note,
                                                String example) {
        return new ImportTemplateColumn(
                name, required, "Ngày giờ",
                "yyyy-MM-ddTHH:mm:ss (ví dụ 2026-01-05T09:00:00)",
                note, example, List.of());
    }

    /** Column resolved through the repository of {@code lookupLabel}. */
    public static ImportTemplateColumn lookup(String name,
                                              boolean required,
                                              String lookupLabel,
                                              String note,
                                              String example) {
        return new ImportTemplateColumn(
                name, required, "Tham chiếu",
                "Tên " + lookupLabel + " đã tồn tại",
                note, example, List.of());
    }

    /** Column restricted to a fixed value list, rendered as a dropdown. */
    public static ImportTemplateColumn choice(String name,
                                              boolean required,
                                              List<String> options,
                                              String note) {
        if (options == null || options.isEmpty()) {
            throw new IllegalArgumentException("A choice column needs at least one option: " + name);
        }

        return choice(name, required, options, note, options.get(0));
    }

    /** Column restricted to a fixed value list, rendered as a dropdown. */
    public static ImportTemplateColumn choice(String name,
                                              boolean required,
                                              List<String> options,
                                              String note,
                                              String example) {
        return new ImportTemplateColumn(
                name, required, "Danh sách",
                String.join(" / ", options),
                note, example, options);
    }
}
