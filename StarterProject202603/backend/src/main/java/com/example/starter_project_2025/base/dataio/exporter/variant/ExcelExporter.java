package com.example.starter_project_2025.base.dataio.exporter.variant;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;

@Component
public class ExcelExporter implements Exporter {

    @Override
    public FileFormat format() {
        return FileFormat.EXCEL;
    }

    @Override
    public <T> void export(
            List<T> data,
            ExportSheetConfig<T> config,
            OutputStream os
    ) throws IOException {

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet(config.sheetName());

        // Header
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < config.columns().size(); i++) {
            headerRow.createCell(i)
                    .setCellValue(config.columns().get(i).header());
        }

        // Data
        for (int i = 0; i < data.size(); i++) {
            T item = data.get(i);
            Row row = sheet.createRow(i + 1);

            for (int j = 0; j < config.columns().size(); j++) {
                Object value =
                        config.columns().get(j)
                                .valueExtractor()
                                .apply(item);

                row.createCell(j)
                        .setCellValue(value != null ? value.toString() : "");
            }
        }

        workbook.write(os);
        workbook.close();
    }
}


