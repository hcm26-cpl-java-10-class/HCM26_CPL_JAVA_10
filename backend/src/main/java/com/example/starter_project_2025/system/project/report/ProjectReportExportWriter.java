package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.base.dataio.exporter.builder.ExportConfigBuilder;
import com.example.starter_project_2025.base.dataio.exporter.variant.ExcelExporter;
import com.opencsv.CSVWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component @RequiredArgsConstructor
public class ProjectReportExportWriter {
    private final ExportConfigBuilder configs;
    private final ExcelExporter excel;
    public byte[] write(String format,List<ProjectReportExportRow> rows) throws Exception {
        var config=configs.build(ProjectReportExportRow.class);
        var output=new ByteArrayOutputStream();
        if("EXCEL".equals(format))excel.export(rows,config,output);
        else {
            output.write(new byte[]{(byte)0xEF,(byte)0xBB,(byte)0xBF});
            try(var csv=new CSVWriter(new OutputStreamWriter(output,StandardCharsets.UTF_8))) {
                csv.writeNext(config.columns().stream().map(c->c.header()).toArray(String[]::new));
                for(var row:rows)csv.writeNext(config.columns().stream().map(c->safe(c.valueExtractor().apply(row))).toArray(String[]::new));
            }
        }
        return output.toByteArray();
    }
    private String safe(Object raw) {
        String value=raw==null?"":raw.toString();String stripped=value.stripLeading();
        if(!stripped.isEmpty()&&"=+-@".indexOf(stripped.charAt(0))>=0||value.startsWith("\t")||value.startsWith("\r"))return "'"+value;
        return value;
    }
}
