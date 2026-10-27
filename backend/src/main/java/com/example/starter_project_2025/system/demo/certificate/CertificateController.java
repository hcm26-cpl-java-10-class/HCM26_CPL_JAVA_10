package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/certificates")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Certificate", description = "APIs for managing certificates")
public class CertificateController
        extends BaseCrudDataIoController<Certificate, Long, CertificateDTO, CertificateFilter> {

    CertificateService certificateService;
    CertificateRepository certificateRepository;

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
