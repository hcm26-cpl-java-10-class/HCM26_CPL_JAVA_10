package com.example.starter_project_2025.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.profile.ProfileController;
import com.example.starter_project_2025.system.profile.ProfileService;
import com.example.starter_project_2025.system.profile.dto.ChangePasswordRequest;
import com.example.starter_project_2025.system.profile.dto.UpdateProfileRequest;
import com.example.starter_project_2025.system.profile.dto.UserProfileResponse;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        value = ProfileController.class,
        excludeFilters = @org.springframework.context.annotation.ComponentScan.Filter(
                type = org.springframework.context.annotation.FilterType.ASSIGNABLE_TYPE,
                classes = com.example.starter_project_2025.security.JwtAuthenticationFilter.class
        ),
        excludeAutoConfiguration = {
                org.springframework.boot.autoconfigure.security.oauth2.client.servlet.OAuth2ClientAutoConfiguration.class,
                org.springframework.boot.autoconfigure.security.oauth2.resource.servlet.OAuth2ResourceServerAutoConfiguration.class
        }
)
@AutoConfigureMockMvc(addFilters = false)
public class ProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ProfileService profileService;

    private UserPrincipal mockPrincipal;
    private UsernamePasswordAuthenticationToken mockAuth;
    private UserProfileResponse mockProfileResponse;

    @BeforeEach
    void setUp() {
        Role adminRole = Role.builder().name("ADMIN").build();

        User user = User.builder()
                .id(1L)
                .email("admin@example.com")
                .firstName("Minh Anh")
                .lastName("Tran")
                .phoneNumber("0903 221 879")
                .employeeCode("EMP10014")
                .department("FHN.G2")
                .isActive(true)
                .roles(Set.of(adminRole))
                .build();

        mockPrincipal = UserPrincipal.fromUser(user);
        mockAuth = new UsernamePasswordAuthenticationToken(mockPrincipal, null, mockPrincipal.getAuthorities());

        mockProfileResponse = UserProfileResponse.builder()
                .id(1L)
                .fullName("Minh Anh Tran")
                .firstName("Minh Anh")
                .lastName("Tran")
                .email("admin@example.com")
                .employeeCode("EMP10014")
                .phoneNumber("0903 221 879")
                .role("ADMIN")
                .roles(Set.of("ADMIN"))
                .department("FHN.G2")
                .status("Active")
                .lastLogin(null)
                .device(null)
                .skills(List.of("Java", "Curriculum", "Agile"))
                .build();
    }

    @Test
    @DisplayName("GET /api/profile - Should return 200 with profile DTO when authenticated")
    void getProfile_Authenticated_ShouldReturn200() throws Exception {
        when(profileService.getProfile("admin@example.com")).thenReturn(mockProfileResponse);

        mockMvc.perform(get("/api/profile").principal(mockAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@example.com"))
                .andExpect(jsonPath("$.fullName").value("Minh Anh Tran"))
                .andExpect(jsonPath("$.employeeCode").value("EMP10014"))
                .andExpect(jsonPath("$.phoneNumber").value("0903 221 879"))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.department").value("FHN.G2"))
                .andExpect(jsonPath("$.status").value("Active"));
    }

    @Test
    @DisplayName("GET /api/profile - Should return 200 with lastLogin when present")
    void getProfile_WithLastLogin_ShouldReturnTimestamp() throws Exception {
        UserProfileResponse responseWithLogin = UserProfileResponse.builder()
                .id(1L)
                .email("admin@example.com")
                .fullName("Minh Anh Tran")
                .lastLogin("2026-10-21T08:00:00Z")
                .lastLoginAt(java.time.Instant.parse("2026-10-21T08:00:00Z"))
                .device("Chrome · Windows 11")
                .build();

        when(profileService.getProfile("admin@example.com")).thenReturn(responseWithLogin);

        mockMvc.perform(get("/api/profile").principal(mockAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastLogin").value("2026-10-21T08:00:00Z"))
                .andExpect(jsonPath("$.lastLoginAt").value("2026-10-21T08:00:00Z"))
                .andExpect(jsonPath("$.device").value("Chrome · Windows 11"));
    }

    @Test
    @DisplayName("PUT /api/profile - Should update profile and return 200")
    void updateProfile_ValidRequest_ShouldReturn200() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest("Jane Doe", "0912 345 678");

        UserProfileResponse updatedResponse = UserProfileResponse.builder()
                .id(1L)
                .fullName("Jane Doe")
                .email("admin@example.com")
                .phoneNumber("0912 345 678")
                .role("ADMIN")
                .build();

        when(profileService.updateProfile(eq("admin@example.com"), any(UpdateProfileRequest.class)))
                .thenReturn(updatedResponse);

        mockMvc.perform(put("/api/profile")
                        .principal(mockAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Jane Doe"))
                .andExpect(jsonPath("$.phoneNumber").value("0912 345 678"));
    }

    @Test
    @DisplayName("PUT /api/profile - Should return 400 when full name is blank")
    void updateProfile_BlankName_ShouldReturn400() throws Exception {
        UpdateProfileRequest invalidRequest = new UpdateProfileRequest("", "0912 345 678");

        mockMvc.perform(put("/api/profile")
                        .principal(mockAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/profile - Should return 400 when phone number format is invalid")
    void updateProfile_InvalidPhone_ShouldReturn400() throws Exception {
        UpdateProfileRequest invalidRequest = new UpdateProfileRequest("Valid Name", "abc-invalid-phone");

        mockMvc.perform(put("/api/profile")
                        .principal(mockAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/profile/change-password - Should return 204 when valid")
    void changePassword_ValidRequest_ShouldReturn204() throws Exception {
        ChangePasswordRequest request = new ChangePasswordRequest("oldPass123", "newSecretPass99", "newSecretPass99");

        mockMvc.perform(post("/api/profile/change-password")
                        .principal(mockAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNoContent());

        verify(profileService).changePassword(eq("admin@example.com"), any(ChangePasswordRequest.class));
    }

    @Test
    @DisplayName("GET /api/profile - Should return 403 Forbidden when unauthenticated")
    void getProfile_Unauthenticated_ShouldReturn403() throws Exception {
        mockMvc.perform(get("/api/profile"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("PUT /api/profile - Should return 403 Forbidden when unauthenticated")
    void updateProfile_Unauthenticated_ShouldReturn403() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest("Jane Doe", "0912 345 678");

        mockMvc.perform(put("/api/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("PUT /api/profile - Mass assignment protection ignores untracked/privileged fields")
    void updateProfile_MassAssignmentIgnored_ShouldReturn200() throws Exception {
        String payloadWithExtraFields = """
                {
                    "fullName": "Jane Doe",
                    "phoneNumber": "0912 345 678",
                    "role": "SUPER_ADMIN",
                    "email": "hacked@example.com",
                    "employeeCode": "HACK999",
                    "department": "DIRECTORS"
                }
                """;

        UserProfileResponse updatedResponse = UserProfileResponse.builder()
                .id(1L)
                .fullName("Jane Doe")
                .email("admin@example.com")
                .phoneNumber("0912 345 678")
                .role("ADMIN")
                .build();

        when(profileService.updateProfile(eq("admin@example.com"), any(UpdateProfileRequest.class)))
                .thenReturn(updatedResponse);

        mockMvc.perform(put("/api/profile")
                        .principal(mockAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payloadWithExtraFields))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Jane Doe"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    @DisplayName("POST /api/profile/change-password - Should return 403 Forbidden when unauthenticated")
    void changePassword_Unauthenticated_ShouldReturn403() throws Exception {
        ChangePasswordRequest request = new ChangePasswordRequest("oldPass123", "newSecretPass99", "newSecretPass99");

        mockMvc.perform(post("/api/profile/change-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("POST /api/profile/change-password - Should return 400 when new password has no number")
    void changePassword_MissingNumber_ShouldReturn400() throws Exception {
        ChangePasswordRequest invalid = new ChangePasswordRequest("oldPass123", "purelettersonly", "purelettersonly");

        mockMvc.perform(post("/api/profile/change-password")
                        .principal(mockAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/profile/change-password - Should return 400 when new password has no letter")
    void changePassword_MissingLetter_ShouldReturn400() throws Exception {
        ChangePasswordRequest invalid = new ChangePasswordRequest("oldPass123", "1234567890", "1234567890");

        mockMvc.perform(post("/api/profile/change-password")
                        .principal(mockAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /api/profile/change-password - Should return 400 when new password is under 8 characters")
    void changePassword_TooShort_ShouldReturn400() throws Exception {
        ChangePasswordRequest invalid = new ChangePasswordRequest("oldPass123", "sh0rt", "sh0rt");

        mockMvc.perform(post("/api/profile/change-password")
                        .principal(mockAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
    }
}
