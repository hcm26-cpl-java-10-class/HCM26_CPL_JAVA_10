package com.example.starter_project_2025.base.dataio.exporter.service;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.builder.ExportConfigBuilder;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import com.example.starter_project_2025.base.dataio.exporter.variant.Exporter;
import com.example.starter_project_2025.base.dataio.util.ExportFileNameBuilder;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AccessLevel;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class GenericExportService implements ExportService {

    Map<FileFormat, Exporter> exporters;
    ExportConfigBuilder configBuilder;

    public GenericExportService(
            List<Exporter> exporterList,
            ExportConfigBuilder configBuilder
    ) {
        this.exporters = exporterList.stream()
                .collect(Collectors.toMap(Exporter::format, e -> e));
        this.configBuilder = configBuilder;
    }

    @Override
    public <T> void export(
            FileFormat format,
            List<T> data,
            Class<T> clazz,
            HttpServletResponse response
    ) throws IOException {

        if (data == null) {
            throw new IllegalArgumentException("Export data cannot be null");
        }

        if (!clazz.isAnnotationPresent(ExportEntity.class)) {
            throw new IllegalArgumentException(
                    "Class " + clazz.getSimpleName() +
                            " must be annotated with @ExportEntity"
            );
        }

        ExportSheetConfig<T> config = configBuilder.build(clazz);

        Exporter exporter = getExporter(format);

        String fileName = resolveFileName(clazz, format);

        setResponseHeader(format, fileName, response);

        try (var out = response.getOutputStream()) {
            exporter.export(data, config, out);
            out.flush();
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }

    private Exporter getExporter(FileFormat format) {
        Exporter exporter = exporters.get(format);

        if (exporter == null) {
            throw new IllegalArgumentException(
                    "Unsupported export format: " + format);
        }
        return exporter;
    }

    private String resolveFileName(Class<?> clazz, FileFormat format) {

        ExportEntity meta = clazz.getAnnotation(ExportEntity.class);

        String baseName = (meta != null)
                ? meta.fileName()
                : clazz.getSimpleName().toLowerCase();

        return ExportFileNameBuilder.build(
                baseName,
                format.getExtension()
        );
    }

    private void setResponseHeader(
            FileFormat format,
            String finalName,
            HttpServletResponse response
    ) {
        response.setContentType(format.getContentType());

        response.setHeader(
                "Content-Disposition",
                "attachment; filename=\"" + finalName + "\""
        );

        response.setHeader(
                "Access-Control-Expose-Headers",
                "Content-Disposition"
        );
    }
}

