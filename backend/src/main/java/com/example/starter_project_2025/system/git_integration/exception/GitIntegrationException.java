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

    // ---- GI-07: disconnect GitHub -------------------------------------------------------------------

    public static GitIntegrationException disconnectConfirmationMismatch() {
        return new GitIntegrationException(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_DISCONNECT_CONFIRMATION_MISMATCH",
                "Tên tài khoản hoặc organization nhập vào không khớp");
    }

    // ---- SY-06: synchronization history ------------------------------------------------------------

    public static GitIntegrationException syncHistoryNotFound() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_SYNC_HISTORY_NOT_FOUND",
                "Không tìm thấy lần đồng bộ này trong project");
    }

    public static GitIntegrationException repositoryNotReceiving() {
        return new GitIntegrationException(HttpStatus.CONFLICT, "GIT_REPOSITORY_NOT_RECEIVING",
                "Repository đã bị gỡ liên kết hoặc mất kết nối nên event sẽ không được xử lý");
    }

    public static GitIntegrationException pullRequestNotFound() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_PULL_REQUEST_NOT_FOUND",
                "Không tìm thấy pull request");
    }

    public static GitIntegrationException backlogItemNotFound() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_BACKLOG_ITEM_NOT_FOUND",
                "Không tìm thấy task");
    }

    // ---- GI-06: connect GitHub account & map to project member ----------------------------------------

    /** AC06: neither a member of the master project nor of one of its modules. */
    public static GitIntegrationException notProjectMember() {
        return new GitIntegrationException(HttpStatus.FORBIDDEN, "GIT_NOT_PROJECT_MEMBER",
                "Bạn không phải thành viên của project hoặc module trực thuộc nên không thể kết nối GitHub");
    }

    /** AC04: the GitHub account is already linked to another internal account. */
    public static GitIntegrationException identityLinkedElsewhere() {
        return new GitIntegrationException(HttpStatus.CONFLICT, "GIT_IDENTITY_LINKED_ELSEWHERE",
                "Tài khoản GitHub này đã được liên kết với một tài khoản khác trên hệ thống");
    }

    /** The user already proved another GitHub account. */
    public static GitIntegrationException identityMismatch(String linkedLogin) {
        return withDetails(HttpStatus.CONFLICT, "GIT_IDENTITY_MISMATCH",
                "Tài khoản của bạn đang liên kết với một tài khoản GitHub khác",
                linkedLogin == null ? null : Map.of("login", linkedLogin));
    }

    /** AC05: the GitHub account is mapped to another member of the master project. */
    public static GitIntegrationException accountMappedToOtherMember() {
        return new GitIntegrationException(HttpStatus.CONFLICT, "GIT_ACCOUNT_MAPPED_TO_OTHER_MEMBER",
                "Tài khoản GitHub này đã được map cho một thành viên khác của project");
    }

    public static GitIntegrationException accountMappingNotFound() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_ACCOUNT_MAPPING_NOT_FOUND",
                "Thành viên chưa map tài khoản GitHub trong project này");
    }

    public static GitIntegrationException contributorNotFound() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_CONTRIBUTOR_NOT_FOUND",
                "Không tìm thấy contributor");
    }

    /** BR4: a GitHub account is mapped only by its owner through Connect. */
    public static GitIntegrationException contributorHasGitHubId() {
        return new GitIntegrationException(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_CONTRIBUTOR_HAS_GITHUB_ID",
                "Contributor có tài khoản GitHub: chủ tài khoản cần tự kết nối GitHub");
    }

    public static GitIntegrationException assigneeNotMember() {
        return new GitIntegrationException(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_ASSIGNEE_NOT_MEMBER",
                "Người được gán không phải thành viên của project hoặc module trực thuộc");
    }

    // ---- TM-03: manual task links ------------------------------------------------------------------

    public static GitIntegrationException taskLinkNotFound() {
        return new GitIntegrationException(HttpStatus.NOT_FOUND, "GIT_TASK_LINK_NOT_FOUND",
                "Không tìm thấy liên kết của task");
    }

    public static GitIntegrationException taskOutsideProject() {
        return new GitIntegrationException(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_TASK_OUTSIDE_PROJECT",
                "Task không thuộc master project của repository hoặc module của nó");
    }

    public static GitIntegrationException taskInactive() {
        return new GitIntegrationException(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_TASK_INACTIVE",
                "Task đã bị xoá nên không thể liên kết");
    }

    public static GitIntegrationException taskLinkTypeNotSupported() {
        return new GitIntegrationException(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_TASK_LINK_TYPE_NOT_SUPPORTED",
                "Hiện chỉ liên kết thủ công được pull request");
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

    /** GI-05: this repository is the project's repository but DISCONNECTED / ERROR: sync it again or unlink it. */
    public static GitIntegrationException repositoryNeedsAttention(Object repository) {
        return withDetails(HttpStatus.CONFLICT, "GIT_REPOSITORY_NEEDS_ATTENTION",
                "Repository này đang được liên kết nhưng bị mất kết nối hoặc lỗi. Hãy đồng bộ lại hoặc hủy liên kết",
                Map.of("repository", repository));
    }

    /** GI-05: the project's repository changed since the page was loaded (unlink of another connection). */
    public static GitIntegrationException repositoryChanged() {
        return new GitIntegrationException(HttpStatus.CONFLICT, "GIT_REPOSITORY_CHANGED",
                "Repository của project vừa thay đổi. Hãy tải lại và kiểm tra lần nữa");
    }

    /** GI-05: "Sync again" is limited to one GitHub check per connection every few seconds. */
    public static GitIntegrationException recheckTooSoon() {
        return new GitIntegrationException(HttpStatus.TOO_MANY_REQUESTS, "GIT_RECHECK_TOO_SOON",
                "Vừa kiểm tra xong. Hãy thử lại sau ít giây");
    }

    public static GitIntegrationException repositoryArchived() {
        return new GitIntegrationException(HttpStatus.UNPROCESSABLE_ENTITY, "GIT_REPOSITORY_ARCHIVED",
                "Repository đã được lưu trữ (archived) hoặc bị vô hiệu hóa trên GitHub nên không thể liên kết");
    }

    /** WS-GH-02: {@code range} (or the since/until of a custom range) of the insights is not valid. */
    public static GitIntegrationException insightsRangeInvalid() {
        return new GitIntegrationException(HttpStatus.BAD_REQUEST, "GIT_INSIGHTS_RANGE_INVALID",
                "Khoảng thời gian không hợp lệ (hỗ trợ 7d, 30d, 90d, 6m, 1y, all; custom cần since ≤ until ≤ hôm nay)");
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

    /** GI-02: GitHub refused the installation (token 401/404); "Check again" or reconnect. */
    public static GitIntegrationException installationError() {
        return new GitIntegrationException(HttpStatus.CONFLICT, "GIT_INSTALLATION_ERROR",
                "GitHub từ chối kết nối. Hãy kiểm tra lại kết nối GitHub", null, "ERROR");
    }

    /** GI-02: an installation in the given status, as the error a user request gets. */
    public static GitIntegrationException installationBroken(String installationStatus) {
        return "ERROR".equals(installationStatus) ? installationError() : installationNotActive(installationStatus);
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
