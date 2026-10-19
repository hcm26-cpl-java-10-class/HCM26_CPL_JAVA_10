package com.example.starter_project_2025.base.dataio.importer.parser;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

public interface FileParser {

    List<Map<String, String>> parse(InputStream inputStream);

    boolean supports(String filename);
}
