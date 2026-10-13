package com.example.starter_project_2025.system.auth.verify;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.ui.Model;

@Controller
@RequiredArgsConstructor
@RequestMapping("/verify")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Verification", description = "Manage verification-related operations")
public class VerificationController {

    VerificationService verificationService;

    @NonFinal
    @Value("${app.frontend-domain}")
    String frontendDomain;

    @GetMapping
    public String verify(
            @RequestParam("token") String token,
            Model model
    ) {
        model.addAttribute("frontendDomain", frontendDomain);
        return !verificationService.verifyEmail(token) ?
            "page/verification_failed_page"
                :
                "page/verification_success_page";
    }

}
