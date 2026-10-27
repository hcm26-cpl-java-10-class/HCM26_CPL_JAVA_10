package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.dataio.importer.parser.FileParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoleImportServiceTest {

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private PermissionRepository permissionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ParserFactory parserFactory;

    @Mock
    private FileParser fileParser;

    private RoleServiceImpl roleService;

    @BeforeEach
    void setUp() {
        roleService = new RoleServiceImpl(
                null,
                roleRepository,
                permissionRepository,
                userRepository,
                parserFactory);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin",
                        "password",
                        List.of(new SimpleGrantedAuthority("ROLE_CREATE"))));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void doesNotSaveAnyRolesWhenAnyRowHasValidationErrors() throws Exception {
        when(parserFactory.getParser("roles.xlsx")).thenReturn(fileParser);
        when(fileParser.parse(any())).thenReturn(List.of(Map.of(
                "Name", "Editor",
                "Description", "x".repeat(1001),
                "Permissions", "ROLE_UNKNOWN")));
        when(roleRepository.findByName("Editor")).thenReturn(Optional.empty());
        when(permissionRepository.findByName("ROLE_UNKNOWN")).thenReturn(Optional.empty());

        ImportResult result = roleService.importRoles(excelFile());

        assertEquals(0, result.getSuccessCount());
        assertEquals(1, result.getFailureCount());
        assertEquals(1, result.getErrors().size());
        assertEquals(2, result.getErrors().get(0).getRowNumber());
        verify(roleRepository, never()).saveAll(anyList());
    }

    @Test
    void savesAllRowsWhenEveryRowIsValid() throws Exception {
        when(parserFactory.getParser("roles.xlsx")).thenReturn(fileParser);
        when(fileParser.parse(any())).thenReturn(List.of(Map.of(
                "Name", "Editor",
                "Description", "Content editor",
                "Permissions", "",
                "Is Active", "Active")));
        when(roleRepository.findByName("Editor")).thenReturn(Optional.empty());
        when(roleRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        ImportResult result = roleService.importRoles(excelFile());

        assertEquals(1, result.getSuccessCount());
        assertEquals(0, result.getFailureCount());
        verify(roleRepository).saveAll(anyList());
    }

    private MockMultipartFile excelFile() {
        return new MockMultipartFile(
                "file",
                "roles.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[]{1});
    }
}
