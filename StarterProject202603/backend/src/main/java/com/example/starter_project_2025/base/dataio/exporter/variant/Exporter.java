package com.example.starter_project_2025.base.dataio.exporter.variant;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;

public interface Exporter {

    FileFormat format();

    <T> void export(
            List<T> data,
            ExportSheetConfig<T> config,
            OutputStream os
    ) throws IOException;
}


