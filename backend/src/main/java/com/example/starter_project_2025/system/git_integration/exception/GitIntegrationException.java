package com.example.starter_project_2025.system.git_integration.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.Map;

/** Business error of the Git Integration module, rendered with a stable {@code code} for the frontend. */
@Getter
public class GitIntegrationException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    /** GIT_RATE_LIMITED: seconds until GitHub accepts requests again. */
    private final Long retryAfterSeconds;
    /** GIT_INSTALLATION_NOT_ACTIVE: the installation's current status. */
    private final String installationStatus;
    /** GI-04: context for the frontend, e.g. the repository already linked or the master project. */
    private final Map<String, Object> details;

    public GitIntegrationException(HttpStatus status, String code, String message) {
        this(status, code, message, null, null, null);
    }

    private GitIntegrationException(HttpStatus status, String code, String message,
                                    Long retryAfterSeconds, String installationStatus) {
        this(status, code, message, retryAfterSeconds, installationStatus, null);
    }

    private GitIntegrationException(HttpStatus status, String code, String message,
                                    Long retryAfterSeconds, String installationStatus, Map<String, Object> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
        this.installationStatus = installationStatus;
        this.details = details;
    }

    private static GitIntegrationException withDetails(HttpStatus status, String code, String message,
                                                       Map<String, Object> details) {
        return new GitIntegrationException(status, code, message, null, null, details);
    }

    // ---- GI-04: link a repository to a master project -------------------------------------------

    public static GitIntegrationException webhookEventNotFound() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_WEBHOOK_EVENT_NOT_FOUND",
                "Không tìm thấy webhook event");
    }

    public static GitIntegrationException webhookEventNotReplayable() {
        return new GitIntegrationException(HttpStatus.CONFLICT, "GIT_WEBHOOK_EVENT_NOT_REPLAYABLE",
                "Chỉ xử lý lại được event FAILED, hoặc event push / pull request / review đã bị IGNORED");
    }

    public static GitIntegrationException webhookPayloadPurged() {
        return new GitIntegrationException(HttpStatus.CONFLICT, "GIT_WEBHOOK_PAYLOAD_PURGED",
                "Payload của event đã bị xoá theo thời hạn lưu trữ nên không thể xử lý lại");
    }

    public static GitIntegrationException pullRequestNotFound() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_PULL_REQUEST_NOT_FOUND",
                "Không tìm thấy pull request");
    }

    public static GitIntegrationException projectNotFound() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_PROJECT_NOT_FOUND",
                "Không tìm thấy project");
    }

    /** AC05: modules share the master project's repository. */
    public static GitIntegrationException projectNotMaster(Object masterProject) {
        return withDetails(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_PROJECT_NOT_MASTER",
                "Module dùng chung repository của master project. Hãy liên kết repository tại master project",
                Map.of("masterProject", masterProject));
    }

    public static GitIntegrationException projectNotLinkable(String projectStatus) {
        return withDetails(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_PROJECT_NOT_LINKABLE",
                "Project đã kết thúc hoặc không còn hoạt động nên không thể liên kết repository",
                Map.of("projectStatus", projectStatus));
    }

    /** AC02: the master project already has an ACTIVE repository. */
    public static GitIntegrationException projectAlreadyLinked(Object repository) {
        return withDetails(HttpStatus.CONFLICT, "GIT_PROJECT_ALREADY_LINKED",
                "Project đã có repository được liên kết",
                Map.of("repository", repository));
    }

    /** AC03: the repository is ACTIVE in another master project. */
    public static GitIntegrationException repositoryInUse(Object linkedProject) {
        return withDetails(HttpStatus.CONFLICT, "GIT_REPOSITORY_IN_USE",
                "Repository đã được sử dụng bởi một project khác",
                linkedProject == null ? null : Map.of("linkedProject", linkedProject));
    }

    /** AC04: the GitHub App cannot access the repository (any more). */
    public static GitIntegrationException repositoryNotAccessible() {
        return new GitIntegrationException(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_REPOSITORY_NOT_ACCESSIBLE",
                "GitHub App không có quyền truy cập repository này");
    }

    public static GitIntegrationException repositoryArchived() {
        return new GitIntegrationException(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_REPOSITORY_ARCHIVED",
                "Repository đã được lưu trữ (archived) hoặc bị vô hiệu hóa trên GitHub nên không thể liên kết");
    }

    public static GitIntegrationException repositoryNotLinked() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_REPOSITORY_NOT_LINKED",
                "Project chưa liên kết repository");
    }

    public static GitIntegrationException installationNotFound() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_INSTALLATION_NOT_FOUND",
                "Không tìm thấy kết nối GitHub");
    }

    public static GitIntegrationException installationNotActive(String installationStatus) {
        return new GitIntegrationException(HttpStatus.CONFLICT, "GIT_INSTALLATION_NOT_ACTIVE",
                "Kết nối GitHub hiện không hoạt động", null, installationStatus);
    }

    public static GitIntegrationException rateLimited(Long retryAfterSeconds) {
        return new GitIntegrationException(HttpStatus.TOO_MANY_REQUESTS, "GIT_RATE_LIMITED",
                "GitHub đang giới hạn số lượt gọi. Vui lòng thử lại sau", retryAfterSeconds, null);
    }

    public static GitIntegrationException disabled() {
        return new GitIntegrationException(HttpStatus.SERVICE_UNAVAILABLE, "GIT_INTEGRATION_DISABLED",
                "Tích hợp GitHub chưa được bật trên hệ thống");
    }

    public static GitIntegrationException stateInvalid() {
        return new GitIntegrationException(HttpStatus.BAD_REQUEST, "GIT_STATE_INVALID",
                "Phiên kết nối GitHub không hợp lệ hoặc đã hết hạn. Vui lòng thử kết nối lại");
    }

    public static GitIntegrationException denied() {
        return new GitIntegrationException(HttpStatus.BAD_REQUEST, "GIT_AUTHORIZATION_DENIED",
                "Kết nối GitHub thất bại do người dùng từ chối cấp quyền");
    }

    public static GitIntegrationException callbackInvalid() {
        return new GitIntegrationException(HttpStatus.BAD_REQUEST, "GIT_CALLBACK_INVALID",
                "Dữ liệu trả về từ GitHub không hợp lệ. Vui lòng thử kết nối lại");
    }

    public static GitIntegrationException installationNotOwned() {
        return new GitIntegrationException(HttpStatus.FORBIDDEN, "GIT_INSTALLATION_NOT_OWNED",
                "Installation GitHub không thuộc về tài khoản đã xác thực");
    }

    public static GitIntegrationException linkedElsewhere() {
        return new GitIntegrationException(HttpStatus.CONFLICT, "GIT_INSTALLATION_LINKED_ELSEWHERE",
                "Installation GitHub này đã được một tổ chức khác trên hệ thống kết nối");
    }

    public static GitIntegrationException providerUnavailable() {
        return new GitIntegrationException(HttpStatus.BAD_GATEWAY, "GIT_PROVIDER_UNAVAILABLE",
                "Không thể liên lạc với GitHub. Vui lòng thử lại sau");
    }
}
