package com.example.starter_project_2025.system.notification.template;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmailTemplateVersionRepository extends JpaRepository<EmailTemplateVersion, Long> {

    List<EmailTemplateVersion> findByTemplateIdOrderByVersionDesc(Long templateId);
}
