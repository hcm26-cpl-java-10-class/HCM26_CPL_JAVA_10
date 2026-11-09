package com.example.starter_project_2025.system.auth.authentication.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.Map;
import java.util.Set;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuthenticationResponse {

    String accessToken;
    String refreshToken;
    String email;
    String firstName;
    String lastName;
    String role;
    Set<String> roles;
    Set<String> permissions;
    Map<String, Set<String>> rolePermissions;

    /**
     * True when the password was correct but the account still has a temporary password. No tokens are
     * issued in that case: the client must send the user to the "create your password" page with
     * {@link #setupToken}.
     */
    Boolean passwordChangeRequired;

    /** One-time token (valid for a short time) that authorises setting the new password. */
    String setupToken;
}
