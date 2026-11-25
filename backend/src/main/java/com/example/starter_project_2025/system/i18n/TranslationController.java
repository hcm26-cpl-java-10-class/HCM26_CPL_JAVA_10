package com.example.starter_project_2025.system.i18n;

import com.example.starter_project_2025.system.i18n.dto.LanguageInfoResponse;
import com.example.starter_project_2025.system.i18n.dto.TranslateRequest;
import com.example.starter_project_2025.system.i18n.dto.TranslateResponse;
import com.example.starter_project_2025.system.i18n.service.TranslationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/i18n")
@RequiredArgsConstructor
public class TranslationController {

    private final TranslationService translationService;
    private final I18nProperties i18nProperties;

    /**
     * Dịch một danh sách chuỗi sang ngôn ngữ đích.
     *
     * <p>Frontend gom các chuỗi chưa có trong dictionary và gọi endpoint này, nên chuỗi mới
     * xuất hiện trong code vẫn được dịch mà không cần sửa component.
     */
    @PostMapping("/translate")
    public ResponseEntity<TranslateResponse> translate(@Valid @RequestBody TranslateRequest request) {
        TranslateResponse response = translationService.translate(
                request.targetLanguage(),
                request.sourceLanguage(),
                request.texts()
        );
        return ResponseEntity.ok(response);
    }

    /**
     * Danh sách ngôn ngữ mà backend thực sự dịch được.
     *
     * <p>Frontend dùng endpoint này để không hiển thị một ngôn ngữ mà backend từ chối dịch.
     */
    @GetMapping("/languages")
    public ResponseEntity<List<LanguageInfoResponse>> languages() {
        Set<String> enabled = i18nProperties.resolveSupportedTargets();
        return ResponseEntity.ok(
                I18nLanguages.describeAll().stream()
                        .map(raw -> LanguageInfoResponse.from(raw, enabled))
                        .toList()
        );
    }
}
