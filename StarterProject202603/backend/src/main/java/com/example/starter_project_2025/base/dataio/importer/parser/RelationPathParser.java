package com.example.starter_project_2025.base.dataio.importer.parser;

import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
public class RelationPathParser {

    public List<String> parse(String path) {
        return Arrays.stream(path.split("\\."))
                .map(String::trim)
                .toList();
    }
}
