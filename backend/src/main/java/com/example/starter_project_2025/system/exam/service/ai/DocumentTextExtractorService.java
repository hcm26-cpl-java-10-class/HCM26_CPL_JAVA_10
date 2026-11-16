package com.example.starter_project_2025.system.exam.service.ai;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.dto.AiQuestionGeneratorDTO.DocumentExtractResponse;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Service
@Slf4j
public class DocumentTextExtractorService {

    public static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    public static final int MAX_EXTRACTED_CHARS = 100_000;

    public DocumentExtractResponse extractText(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Tập tin tải lên rỗng hoặc không tồn tại.");
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.txt";
        long size = file.getSize();

        if (size > MAX_FILE_SIZE) {
            throw new BadRequestException("Dung lượng tập tin vượt quá giới hạn cho phép (tối đa 10MB).");
        }

        String ext = getFileExtension(originalFilename).toLowerCase();
        String extracted;

        try (InputStream is = file.getInputStream()) {
            switch (ext) {
                case "pdf" -> extracted = extractFromPdf(is);
                case "docx" -> extracted = extractFromDocx(is);
                case "pptx" -> extracted = extractFromPptx(is);
                case "txt", "md" -> extracted = extractFromTxt(file.getBytes());
                default -> throw new BadRequestException(
                        "Định dạng tập tin ." + ext + " không được hỗ trợ. Vui lòng tải lên tài liệu định dạng PDF, DOCX, PPTX hoặc TXT."
                );
            }
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to parse document: {}", originalFilename, e);
            throw new BadRequestException("Không thể đọc nội dung tài liệu " + originalFilename + ": " + e.getMessage() + ". Vui lòng kiểm tra lại tập tin.");
        }

        if (extracted == null || extracted.trim().isEmpty()) {
            throw new BadRequestException("Tài liệu không chứa nội dung văn bản hoặc không thể trích xuất được.");
        }

        String cleanText = extracted.trim();
        if (cleanText.length() > MAX_EXTRACTED_CHARS) {
            cleanText = cleanText.substring(0, MAX_EXTRACTED_CHARS) + "\n...[Nội dung đã được rút gọn do vượt quá 100,000 ký tự]";
        }

        return DocumentExtractResponse.builder()
                .fileName(originalFilename)
                .fileSize(size)
                .charCount(cleanText.length())
                .extractedText(cleanText)
                .status("SUCCESS")
                .message("Trích xuất nội dung tài liệu thành công (" + cleanText.length() + " ký tự).")
                .build();
    }

    private String extractFromPdf(InputStream is) throws Exception {
        try (PdfReader reader = new PdfReader(is);
             PdfDocument pdfDoc = new PdfDocument(reader)) {
            StringBuilder sb = new StringBuilder();
            int numPages = pdfDoc.getNumberOfPages();
            for (int i = 1; i <= numPages; i++) {
                String pageText = PdfTextExtractor.getTextFromPage(pdfDoc.getPage(i));
                if (pageText != null && !pageText.isBlank()) {
                    sb.append(pageText).append("\n\n");
                }
            }
            return sb.toString();
        }
    }

    private String extractFromDocx(InputStream is) throws Exception {
        try (XWPFDocument doc = new XWPFDocument(is);
             XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            return extractor.getText();
        }
    }

    private String extractFromPptx(InputStream is) throws Exception {
        try (XMLSlideShow ppt = new XMLSlideShow(is)) {
            StringBuilder sb = new StringBuilder();
            for (XSLFSlide slide : ppt.getSlides()) {
                for (XSLFShape shape : slide.getShapes()) {
                    if (shape instanceof XSLFTextShape textShape) {
                        String txt = textShape.getText();
                        if (txt != null && !txt.isBlank()) {
                            sb.append(txt).append("\n");
                        }
                    }
                }
                sb.append("\n");
            }
            return sb.toString();
        }
    }

    private String extractFromTxt(byte[] bytes) {
        return new String(bytes, StandardCharsets.UTF_8);
    }

    private String getFileExtension(String filename) {
        int lastDot = filename.lastIndexOf('.');
        if (lastDot >= 0 && lastDot < filename.length() - 1) {
            return filename.substring(lastDot + 1);
        }
        return "";
    }
}
