package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.ActivityResponse;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test cho {@link CourseAnalyticsExportService}.
 *
 * <p>Mục tiêu chính: export Activity phải dùng ĐÚNG ngưỡng {@code inactiveDays}
 * mà Frontend đang chọn, để dữ liệu file Excel khớp với dữ liệu trên màn hình.
 */
class CourseAnalyticsExportServiceTest {

    private CourseAnalyticsService analyticsService;
    private CourseAnalyticsExportService exportService;
    private ActivityResponse response;

    @BeforeEach
    void setUp() {
        analyticsService = mock(CourseAnalyticsService.class);
        exportService = new CourseAnalyticsExportService(analyticsService);
        response = new ActivityResponse(
                1L, "Course", 30, 100, 10, 20, 30, 40, 90, 60, 5, 10, 25, 42.5,
                List.of(), List.of(), List.of());
    }

    @Test
    void exportActivityPassesSelectedInactiveDaysToService() throws Exception {
        when(analyticsService.getActivity(eq(1L), eq(30), isNull())).thenReturn(response);

        byte[] file = exportService.exportActivity(1L, 30);

        verify(analyticsService).getActivity(1L, 30, null);

        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(file))) {
            Sheet summary = workbook.getSheet("Tong hop hoat dong");
            assertNotNull(summary, "Phải có sheet tổng hợp hoạt động");
            // Dòng đầu tiên là header, dòng 2 là "Tong hoc vien".
            assertEquals("Tong hoc vien", summary.getRow(1).getCell(0).getStringCellValue());
            assertEquals(100, (int) summary.getRow(1).getCell(1).getNumericCellValue());
            // Dòng "Nguong khong hoat dong (ngay)" phải là 30 -> khớp bộ lọc đang chọn.
            assertEquals("Nguong khong hoat dong (ngay)", summary.getRow(10).getCell(0).getStringCellValue());
            assertEquals(30, (int) summary.getRow(10).getCell(1).getNumericCellValue());
        }
    }

    @Test
    void exportActivityWithoutFilterUsesDefaultThreshold() throws Exception {
        when(analyticsService.getActivity(eq(1L), isNull(), isNull())).thenReturn(response);

        exportService.exportActivity(1L, null);

        verify(analyticsService).getActivity(1L, null, null);
    }
}
