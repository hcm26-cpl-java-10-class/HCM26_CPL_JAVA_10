package com.example.starter_project_2025.system.exam.report;

import java.util.List;

/** A titled table that can be rendered to Excel or PDF. */
public record ReportTable(String title, List<String> subtitleLines, List<String> headers, List<List<String>> rows) {
}
