package com.example.starter_project_2025.base.dataio.exporter.service;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.List;

public interface ExportService {

    <T> void export(
            FileFormat format,
            List<T> data,
            Class<T> clazz,
            HttpServletResponse response
    ) throws IOException;
}
