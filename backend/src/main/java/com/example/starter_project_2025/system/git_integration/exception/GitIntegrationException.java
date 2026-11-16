package com.example.starter_project_2025.system.git_integration.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/** Business error of the Git Integration module, rendered with a stable {@code code} for the frontend. */
@Getter
public class GitIntegrationException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public GitIntegrationException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
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
                "Installation GitHub này đã được kết nối với một project khác");
    }

    public static GitIntegrationException providerUnavailable() {
        return new GitIntegrationException(HttpStatus.BAD_GATEWAY, "GIT_PROVIDER_UNAVAILABLE",
                "Không thể liên lạc với GitHub. Vui lòng thử lại sau");
    }
}
