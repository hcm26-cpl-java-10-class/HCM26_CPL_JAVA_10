package com.example.starter_project_2025.system.project.template.resources;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.milestone.submission.service.ArtifactUploadRejectedException;
import com.example.starter_project_2025.system.project.milestone.submission.service.ArtifactUploadUnavailableException;
import com.example.starter_project_2025.system.project.milestone.submission.service.ClamAvScanner;
import com.example.starter_project_2025.system.project.resources.ProjectResourceStorage;
import com.example.starter_project_2025.system.project.resources.ResourceDownloadSigner;
import com.example.starter_project_2025.system.project.template.*;
import com.example.starter_project_2025.system.project.template.version.TemplateVersionConfigurationService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.zip.ZipFile;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TemplateResourceService {
    public static final int MAX_BYTES = 25 * 1024 * 1024;
    public record Resource(Long id, String kind, String title, String fileName, String contentType, Long sizeBytes, String url) { }
    public record Listing(Long templateId, Long versionId, Long lockVersion, boolean editable, long maxFileBytes, List<Resource> resources) { }
    public record LinkRequest(String title, String url, Long lockVersion) { }
    public record DownloadLink(String url, Instant expiresAt) { }
    public record Download(String fileName, FileSystemResource content) { }
    private record Context(User user, ProjectTemplate template, Long versionId, List<TemplateResource> resources, boolean editable) { }

    private final ProjectTemplateRepository templates;
    private final TemplateResourceRepository resources;
    private final ProjectTemplateAccessService access;
    private final TemplateVersionConfigurationService versions;
    private final TemplateConfigurationService configurations;
    private final ProjectTemplateAuditRepository audits;
    private final ProjectResourceStorage storage;
    private final ResourceDownloadSigner signer;
    private final ClamAvScanner scanner;
    private final ObjectMapper json;

    public Listing list(Long templateId, Long versionId) {
        return listing(context(templateId, versionId, false, null));
    }

    @Transactional
    public Listing upload(Long templateId, Long versionId, Long revision, String fileName, long length, InputStream input) {
        Context context = context(templateId, versionId, true, revision);
        if (length > MAX_BYTES) throw tooLarge();
        String name = fileName == null ? "" : fileName.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).strip();
        if (name.isBlank() || name.length() > 255 || name.chars().anyMatch(Character::isISOControl))
            throw invalid("Enter a valid file name of up to 255 characters");
        String extension = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (!List.of("pdf", "docx", "xlsx", "csv", "zip").contains(extension))
            throw invalid("Supported file types: PDF, DOCX, XLSX, CSV and ZIP");
        byte[] bytes;
        try { bytes = input.readNBytes(MAX_BYTES + 1); }
        catch (IOException exception) { throw invalid("The uploaded file could not be read"); }
        if (bytes.length > MAX_BYTES) throw tooLarge();
        if (bytes.length == 0) throw invalid("Choose a non-empty file");
        try { scanner.requireClean(bytes); }
        catch (ArtifactUploadRejectedException exception) { throw invalid("The file was rejected by the malware scanner"); }
        catch (ArtifactUploadUnavailableException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Resource scanning is unavailable. Please try again later.");
        }
        String key = storage.store(bytes);
        String contentType = contentType(extension, bytes, key);
        TemplateResource resource = new TemplateResource();
        resource.setTemplate(context.template()); resource.setKind("FILE"); resource.setTitle(name);
        resource.setFileName(name); resource.setContentType(contentType); resource.setSizeBytes((long) bytes.length);
        resource.setStorageKey(key); resource.setIsActive(false);
        resources.saveAndFlush(resource);
        List<Long> selected = new ArrayList<>(context.resources().stream().map(TemplateResource::getId).toList());
        selected.add(resource.getId());
        save(context, selected, revision);
        return list(templateId, versionId);
    }

    @Transactional
    public Listing addLink(Long templateId, Long versionId, LinkRequest request) {
        Context context = context(templateId, versionId, true, request.lockVersion());
        if (request.title() == null || request.title().isBlank() || request.title().strip().length() > 255)
            throw invalid("Enter a resource title of 1 to 255 characters");
        String url = request.url() == null ? "" : request.url().strip();
        try {
            URI uri = URI.create(url);
            if (url.length() > 2000 || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
                throw new IllegalArgumentException();
        } catch (IllegalArgumentException exception) { throw invalid("Enter a valid HTTPS resource link"); }
        TemplateResource resource = new TemplateResource();
        resource.setTemplate(context.template()); resource.setKind("LINK"); resource.setTitle(request.title().strip());
        resource.setExternalUrl(url); resource.setIsActive(false); resources.saveAndFlush(resource);
        List<Long> selected = new ArrayList<>(context.resources().stream().map(TemplateResource::getId).toList());
        selected.add(resource.getId()); save(context, selected, request.lockVersion());
        return list(templateId, versionId);
    }

    @Transactional
    public Listing remove(Long templateId, Long resourceId, Long versionId, Long revision) {
        Context context = context(templateId, versionId, true, revision);
        requireResource(context, resourceId);
        save(context, context.resources().stream().map(TemplateResource::getId).filter(id -> !id.equals(resourceId)).toList(), revision);
        return list(templateId, versionId);
    }

    public DownloadLink link(Long templateId, Long resourceId, Long versionId) {
        Context context = context(templateId, versionId, false, null);
        TemplateResource resource = requireFile(context, resourceId);
        storage.read(resource.getStorageKey());
        long expires = Instant.now().getEpochSecond() + ResourceDownloadSigner.LIFETIME_SECONDS;
        String signature = signer.sign(context.user().getId(), context.user().getTenantId(), -templateId, resourceId, expires);
        return new DownloadLink("/project-templates/" + templateId + "/resources/" + resourceId
                + "/download?expires=" + expires + "&signature=" + signature
                + (versionId == null ? "" : "&versionId=" + versionId), Instant.ofEpochSecond(expires));
    }

    public Download download(Long templateId, Long resourceId, Long versionId, long expires, String signature) {
        Context context = context(templateId, versionId, false, null);
        TemplateResource resource = requireFile(context, resourceId);
        signer.verify(context.user().getId(), context.user().getTenantId(), -templateId, resourceId, expires, signature);
        return new Download(resource.getFileName(), storage.read(resource.getStorageKey()));
    }

    private Context context(Long id, Long versionId, boolean writing, Long revision) {
        User user = access.requireUser(writing ? "UPDATE" : "READ");
        if (versionId != null && (!access.can(user, "VERSION_READ") || writing && !access.can(user, "VERSION_UPDATE")))
            throw new AccessDeniedException("Template version permission is required");
        ProjectTemplate template = (writing ? templates.findForTemplateUpdate(id, user.getTenantId())
                : templates.findReadableById(id, user.getTenantId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project template was not found"));
        List<TemplateResource> selected;
        boolean editable = template.getTenantId() != null && template.getStatus() == ProjectTemplateStatus.DRAFT && access.can(user, "UPDATE");
        if (versionId == null) selected = resources.findAllByTemplate_IdAndIsActiveTrueOrderByIdAsc(id);
        else {
            var configuration = versions.get(versionId);
            if (!Objects.equals(configuration.template().id(), id)) throw new AccessDeniedException("The version belongs to another template");
            editable = configuration.editable();
            try {
                List<Long> ids = new ArrayList<>();
                json.readTree(configuration.version().getContentJson()).path("resources").forEach(item -> ids.add(item.path("id").asLong()));
                selected = resources.findAllByTemplate_IdAndIdInOrderByIdAsc(id, ids);
                if (selected.size() != ids.size()) throw new AccessDeniedException("A resource is outside this template");
            } catch (JsonProcessingException exception) { throw invalid("The stored resource configuration is invalid"); }
        }
        if (writing) {
            if (!editable) throw ProjectTemplateException.conflict("Only draft template resources can be changed");
            if (revision == null || !revision.equals(template.getLockVersion()))
                throw ProjectTemplateException.conflict("This template has changed. Reload it before saving your changes");
        }
        return new Context(user, template, versionId, selected, editable);
    }

    private void save(Context context, List<Long> ids, Long revision) {
        if (context.versionId() != null) {
            versions.saveResources(context.versionId(), BigDecimal.valueOf(revision), ids);
            return;
        }
        List<TemplateResource> selected = resources.findAllByTemplate_IdAndIdInOrderByIdAsc(context.template().getId(), ids);
        context.resources().forEach(resource -> resource.setIsActive(false));
        resources.saveAllAndFlush(context.resources());
        selected.forEach(resource -> resource.setIsActive(true)); resources.saveAllAndFlush(selected);
        context.template().setUpdatedAt(LocalDateTime.now()); templates.saveAndFlush(context.template());
        configurations.refreshDraft(context.template());
        try {
            audits.save(new ProjectTemplateAudit(context.user().getTenantId(), context.template().getId(), context.user().getId(),
                    "PROJECT_TEMPLATE_RESOURCES_UPDATED", json.writeValueAsString(context.resources().stream().map(TemplateResource::getId).toList()),
                    json.writeValueAsString(ids), CorrelationIdFilter.currentId()));
        } catch (JsonProcessingException exception) { throw new IllegalStateException("Unable to record resource changes", exception); }
    }

    private Listing listing(Context context) {
        return new Listing(context.template().getId(), context.versionId(), context.template().getLockVersion(), context.editable(), MAX_BYTES,
                context.resources().stream().map(resource -> new Resource(resource.getId(), resource.getKind(), resource.getTitle(),
                        resource.getFileName(), resource.getContentType(), resource.getSizeBytes(), resource.getExternalUrl())).toList());
    }

    private TemplateResource requireResource(Context context, Long id) {
        return context.resources().stream().filter(resource -> Objects.equals(resource.getId(), id)).findFirst()
                .orElseThrow(() -> new AccessDeniedException("The resource is outside this template version"));
    }

    private TemplateResource requireFile(Context context, Long id) {
        TemplateResource resource = requireResource(context, id);
        if (!"FILE".equals(resource.getKind())) throw invalid("This resource is a link");
        return resource;
    }

    private String contentType(String extension, byte[] bytes, String key) {
        if ("pdf".equals(extension)) {
            if (bytes.length >= 5 && new String(bytes, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-")) return "application/pdf";
        } else if ("csv".equals(extension)) {
            try {
                String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
                if (text.codePoints().noneMatch(value -> Character.isISOControl(value) && value != '\r' && value != '\n' && value != '\t'))
                    return "text/csv";
            } catch (IOException exception) { throw invalid("The CSV file must contain valid UTF-8 text"); }
        } else {
            try (ZipFile zip = new ZipFile(storage.read(key).getFile())) {
                if ("zip".equals(extension)) return "application/zip";
                if (zip.getEntry("[Content_Types].xml") != null) {
                    if ("docx".equals(extension) && zip.getEntry("word/document.xml") != null)
                        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                    if ("xlsx".equals(extension) && zip.getEntry("xl/workbook.xml") != null)
                        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                }
            } catch (IOException exception) { throw invalid("The uploaded file is not a valid " + extension.toUpperCase(Locale.ROOT) + " file"); }
        }
        throw invalid("The file content does not match its extension");
    }

    private ProjectTemplateException invalid(String message) {
        return new ProjectTemplateException(422, message, Map.of("resources", List.of(message)));
    }

    private ResponseStatusException tooLarge() {
        return new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "File exceeds the maximum allowed size (25 MB per file)");
    }
}
