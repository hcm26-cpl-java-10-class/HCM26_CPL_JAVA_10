package com.example.starter_project_2025.system.location;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocationUserDTO {
    private Long id;
    private String username;
    private String fullName;
    private String email;
    private String phone;
    private String jobTitle;
}