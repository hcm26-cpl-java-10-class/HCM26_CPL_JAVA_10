package com.example.starter_project_2025.base.dataio.template.service;

import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;

@Service
public class ImportTemplateService {

    public byte[] generateTemplate(Class<?> entityClass) {
        try (Workbook workbook = new XSSFWorkbook()) {

            Sheet sheet = workbook.createSheet("Import");

            Row headerRow = sheet.createRow(0);

            int colIndex = 0;

            for (Field field : entityClass.getDeclaredFields()) {
                ImportField col = field.getAnnotation(ImportField.class);
                if (col == null) continue;

                headerRow.createCell(colIndex).setCellValue(col.name());

                ExportField exportField = field.getAnnotation(ExportField.class);
                if (exportField != null && !exportField.hint().isBlank()) {
                    DataValidationHelper helper = sheet.getDataValidationHelper();
                    DataValidation validation = helper.createValidation(
                            helper.createCustomConstraint("TRUE"),
                            new CellRangeAddressList(1, 10_000, colIndex, colIndex));
                    validation.setShowErrorBox(false);
                    validation.setShowPromptBox(true);
                    validation.createPromptBox(col.name(), exportField.hint());
                    sheet.addValidationData(validation);
                }

                colIndex++;
            }

            for (int i = 0; i < colIndex; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            workbook.write(out);

            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate template", e);
        }
    }
}
