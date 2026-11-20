
package com.example.starter_project_2025.base.dataio.template.service;

import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

@Service
public class ImportTemplateService {

    public byte[] generateTemplate(Class<?> entityClass) {

        try (Workbook workbook = new XSSFWorkbook()) {

            Sheet sheet = workbook.createSheet("Import");

            Row headerRow = sheet.createRow(0);

            int colIndex = 0;

            // Lấy field của cả class cha và class con
            for (Field field : getAllFields(entityClass)) {

                ImportField col = field.getAnnotation(ImportField.class);

                if (col == null) {
                    continue;
                }

                headerRow.createCell(colIndex)
                        .setCellValue(col.name());

                colIndex++;
            }

            for (int i = 0; i < colIndex; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();

            workbook.write(out);

            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to generate template",
                    e
            );
        }
    }

    private List<Field> getAllFields(Class<?> clazz) {

        List<Field> fields = new ArrayList<>();

        Class<?> current = clazz;

        while (current != null && current != Object.class) {

            for (Field field : current.getDeclaredFields()) {
                fields.add(field);
            }

            current = current.getSuperclass();
        }

        return fields;
    }
}
