package com.example.starter_project_2025.base.dataio;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportColumn;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import com.example.starter_project_2025.base.dataio.exporter.variant.CsvExporter;
import com.example.starter_project_2025.base.dataio.importer.parser.CsvParser;
import com.example.starter_project_2025.system.study_session.dataio.StudySessionCsvParser;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CsvExporterRegressionTest {
    private final CsvExporter exporter = new CsvExporter();

    @Test
    void preservesPlainColumnsNullsNumbersAndColumnOrderWithoutBom() throws Exception {
        record Row(String title, Integer count, String optional) {}
        var config = new ExportSheetConfig<Row>("Rows", List.of(
                new ExportColumn<>("Title", Row::title),
                new ExportColumn<>("Count", Row::count),
                new ExportColumn<>("Optional", Row::optional)));
        var output = new ByteArrayOutputStream();
        exporter.export(List.of(new Row("Java", 2, null)), config, output);
        assertEquals(FileFormat.CSV, exporter.format());
        assertEquals("Title,Count,Optional\r\nJava,2,\r\n", output.toString(StandardCharsets.UTF_8));
        assertBothParsers(output.toByteArray(), List.of(Map.of("Title", "Java", "Count", "2", "Optional", "")));
    }

    @Test
    void quotesHeadersAndRoundTripsUnicodeQuotesCommasAndMultilineValuesWithBothParsers() throws Exception {
        String header = "Title, \"display\"";
        String value = "Buổi học, tiếng Việt \"Java\"\nDòng thứ hai";
        var output = export(header, List.of(value, "  keep spaces  ", ""));
        assertTrue(new String(output, StandardCharsets.UTF_8).startsWith("\"Title, \"\"display\"\"\"\r\n"));
        assertBothParsers(output, List.of(Map.of(header, value), Map.of(header, "  keep spaces  "), Map.of(header, "")));
    }

    @Test
    void quotesCarriageReturnsAndCrLfWithoutChangingFieldBytes() throws Exception {
        var output = export("Title", List.of("first\rsecond", "first\r\nsecond"));
        assertEquals("Title\r\n\"first\rsecond\"\r\n\"first\r\nsecond\"\r\n",
                new String(output, StandardCharsets.UTF_8));
    }

    @Test
    void emptyDatasetStillExportsTheHeader() throws Exception {
        var output = export("Title", List.of());
        assertEquals("Title\r\n", new String(output, StandardCharsets.UTF_8));
        assertBothParsers(output, List.of());
    }

    @Test
    void propagatesWriteFailuresAndLeavesCallerStreamOpen() throws Exception {
        var config = new ExportSheetConfig<String>("Rows", List.of(new ExportColumn<>("Title", v -> v)));
        var failure = new IOException("output unavailable");
        assertSame(failure, assertThrows(IOException.class, () -> exporter.export(List.of("Java"), config,
                new OutputStream() {
                    @Override public void write(int value) throws IOException { throw failure; }
                })));
        class CallerStream extends ByteArrayOutputStream {
            boolean closed;
            @Override public void close() { closed = true; }
        }
        var output = new CallerStream();
        exporter.export(List.of("Java"), config, output);
        assertFalse(output.closed);
        assertTrue(output.size() > 0);
    }

    private byte[] export(String header, List<String> values) throws IOException {
        var config = new ExportSheetConfig<String>("Rows", List.of(new ExportColumn<>(header, v -> v)));
        var output = new ByteArrayOutputStream();
        exporter.export(values, config, output);
        return output.toByteArray();
    }

    private void assertBothParsers(byte[] csv, List<Map<String, String>> expected) {
        assertEquals(expected, new CsvParser().parse(new ByteArrayInputStream(csv)));
        assertEquals(expected, new StudySessionCsvParser().parse(new ByteArrayInputStream(csv)));
    }
}
