package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/certificates")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Certificate", description = "APIs for managing certificates")
public class CertificateController
        extends BaseCrudDataIoController<Certificate, Long, CertificateDTO, CertificateFilter> {

    CertificateService certificateService;
    CertificateRepository certificateRepository;

    @GetMapping("/verify/{verificationToken}")
    public CertificateVerificationDTO verify(@PathVariable UUID verificationToken) {
        return certificateService.verify(verificationToken);
    }

    @GetMapping("/my-certificates")
    public List<CertificateDTO> getMyCertificates(@AuthenticationPrincipal UserPrincipal principal) {
        Long userId = principal.getUser().getId();
        return certificateService.getMyCertificates(userId);
    }

    @GetMapping("/enrollment/{enrollmentId}")
    @PreAuthorize("hasAuthority('CERTIFICATE_READ')")
    public CertificateDTO getByEnrollment(@PathVariable Long enrollmentId) {
        return certificateService.getByEnrollment(enrollmentId);
    }

    @Override
    protected BaseCrudService<Long, CertificateDTO, CertificateFilter> getService() {
        return certificateService;
    }

    @Override
    protected BaseCrudRepository<Certificate, Long> getRepository() {
        return certificateRepository;
    }

    @Override
    protected Class<Certificate> getEntityClass() {
        return Certificate.class;
    }
}
