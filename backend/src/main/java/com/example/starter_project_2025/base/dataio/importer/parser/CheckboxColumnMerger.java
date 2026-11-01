package com.example.starter_project_2025.base.dataio.importer.parser;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Reads the check box columns of an exported file ("Roles: ADMIN", "Roles: USER", ...) back into the single
 * "Roles" value the import works with ("ADMIN,USER"). A file that still has the plain "Roles" column works as
 * before, and both forms can be mixed.
 */
public final class CheckboxColumnMerger {

    private static final String HEADER_SEPARATOR = ": ";

    private CheckboxColumnMerger() {
    }

    public static void merge(List<Map<String, String>> rows, Class<?> entityClass) {
        for (Field field : entityClass.getDeclaredFields()) {
            ImportField column = field.getAnnotation(ImportField.class);
            if (column == null || column.lookupEntity() == Void.class) {
                continue;
            }

            String prefix = column.name() + HEADER_SEPARATOR;
            String separator = column.separator().isEmpty() ? "," : column.separator();

            for (Map<String, String> row : rows) {
                List<String> values = new ArrayList<>();
                boolean hasCheckboxColumns = false;

                Iterator<Map.Entry<String, String>> it = row.entrySet().iterator();
                while (it.hasNext()) {
                    Map.Entry<String, String> entry = it.next();
                    if (entry.getKey() == null || !entry.getKey().startsWith(prefix)) {
                        continue;
                    }
                    hasCheckboxColumns = true;
                    if ("true".equalsIgnoreCase(String.valueOf(entry.getValue()).trim())) {
                        values.add(entry.getKey().substring(prefix.length()).trim());
                    }
                    it.remove();
                }

                if (!hasCheckboxColumns) {
                    continue;
                }

                String typed = row.get(column.name());
                if (typed != null && !typed.isBlank()) {
                    for (String part : typed.split(Pattern.quote(separator))) {
                        String value = part.trim();
                        if (!value.isEmpty() && !values.contains(value)) {
                            values.add(value);
                        }
                    }
                }

                // Nothing ticked = empty cell, which the import treats as "leave unchanged".
                row.put(column.name(), values.isEmpty() ? null : String.join(separator, values));
            }
        }
    }
}
