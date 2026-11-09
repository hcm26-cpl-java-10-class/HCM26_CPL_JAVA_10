package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class LocationServiceImpl
        extends BaseCrudServiceImpl<Location, Long, LocationDTO, LocationFilter>
        implements LocationService {

    LocationMapper locationMapper;
    LocationRepository locationRepository;
    UserRepository userRepository;

    @Override
    protected BaseCrudRepository<Location, Long> getRepository() {
        return locationRepository;
    }

    @Override
    protected BaseCrudMapper<Location, LocationDTO> getMapper() {
        return locationMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"code", "name", "path"};
    }

    @Override
    protected void beforeCreate(Location location, LocationDTO request, ValidationContext ctx) {
        normalize(request);

        if (locationRepository.existsByCode(request.getCode())) {
            ctx.add("code", "Location code is already in use");
            return;
        }

        Location parent = resolveParent(request.getParentLocationId(), null, ctx);
        if (!ctx.hasErrors()) {
            location.setParentLocation(parent);
        }
    }

    @Override
    protected void beforeUpdate(Location location, LocationDTO request, ValidationContext ctx) {
        normalize(request);

        if (request.getCode() != null && !request.getCode().equals(location.getCode())) {
            if (locationRepository.existsByCode(request.getCode())) {
                ctx.add("code", "Location code is already in use");
            }
        }

        location.updateInfo(request.getName(), request.getDescription());

        Location newParent = resolveParent(request.getParentLocationId(), location.getId(), ctx);
        if (!ctx.hasErrors()) {
            location.setParentLocation(newParent);
        }
    }

    @Override
    protected void beforeDelete(Location location) {
        ValidationContext ctx = new ValidationContext();

        if (location.getChildren() != null && !location.getChildren().isEmpty()) {
            ctx.add("id", "Cannot delete a location that still has child locations");
        }

        ctx.throwIfErrors();
    }

    @Override
    @Transactional(readOnly = true)
    public List<LocationTreeDTO> getTree() {
        checkPermission(CrudAction.READ);

        // Fetch toàn bộ location một lần để Hibernate nạp đầy đủ vào Persistence Context
        List<Location> allLocations = locationRepository.findAll();

        // Lọc ra danh sách các nút gốc (Parent is null)
        List<Location> roots = allLocations.stream()
                .filter(loc -> loc.getParent() == null)
                .sorted(Comparator.comparing(Location::getName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        return roots.stream()
                .map(this::toNode)
                .toList();
    }

    @Transactional
    public void processImportedLocations(List<Location> importedLocations) {
        Map<String, Location> locationMap = new HashMap<>();
        for (Location loc : importedLocations) {
            if (loc.getCode() != null) {
                locationMap.put(loc.getCode().trim(), loc);
            }
        }

        for (Location loc : importedLocations) {
            if (loc.getParentCode() != null && !loc.getParentCode().isBlank()) {
                Location parent = locationMap.get(loc.getParentCode().trim());
                if (parent == null) {
                    parent = locationRepository.findByCode(loc.getParentCode().trim()).orElse(null);
                }
                if (parent != null) {
                    loc.setParentLocation(parent);
                }
            }

            if (loc.getAssignedUserEmails() != null && !loc.getAssignedUserEmails().isBlank()) {
                String[] emails = loc.getAssignedUserEmails().split(",");
                for (String email : emails) {
                    userRepository.findByEmail(email.trim()).ifPresent(loc::addUser);
                }
            }
        }

        locationRepository.saveAll(importedLocations);
    }

    @Override
    @Transactional(readOnly = true)
    public ByteArrayInputStream exportLocationsToExcel() {
        List<Location> locations = locationRepository.findAll();

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Locations");

            // Tạo Header Row
            Row headerRow = sheet.createRow(0);
            String[] headers = {"Code", "Name", "Parent Code", "Description", "Status", "Assigned User Emails"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
            }

            // Ghi dữ liệu từng dòng
            int rowIdx = 1;
            for (Location loc : locations) {
                Row row = sheet.createRow(rowIdx++);

                row.createCell(0).setCellValue(loc.getCode() != null ? loc.getCode() : "");
                row.createCell(1).setCellValue(loc.getName() != null ? loc.getName() : "");

                // Lấy Parent Code
                String parentCode = (loc.getParent() != null) ? loc.getParent().getCode() : "";
                row.createCell(2).setCellValue(parentCode);

                row.createCell(3).setCellValue(loc.getDescription() != null ? loc.getDescription() : "");
                row.createCell(4).setCellValue(loc.getStatus() != null ? loc.getStatus().name() : "ACTIVE");

                // Gom danh sách Email User phân cách bằng dấu phẩy
                String assignedEmails = "";
                if (loc.getUsers() != null && !loc.getUsers().isEmpty()) {
                    assignedEmails = loc.getUsers().stream()
                            .map(User::getEmail)
                            .filter(Objects::nonNull)
                            .collect(Collectors.joining(","));
                }
                row.createCell(5).setCellValue(assignedEmails);
            }

            workbook.write(out);
            return new ByteArrayInputStream(out.toByteArray());
        } catch (Exception e) {
            throw new RuntimeException("Failed to export locations to Excel: " + e.getMessage());
        }
    }

    private LocationTreeDTO toNode(Location loc) {
        Set<Location> rawChildren = loc.getChildren();
        List<LocationTreeDTO> childrenNodes = (rawChildren == null || rawChildren.isEmpty())
                ? List.of()
                : rawChildren.stream()
                .sorted(Comparator.comparing(Location::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toNode)
                .toList();

        Set<User> rawUsers = loc.getUsers();
        List<UserSummaryDTO> userSummaries = (rawUsers == null || rawUsers.isEmpty())
                ? List.of()
                : rawUsers.stream()
                .map(u -> {
                    String roleName = (u.getRoles() != null && !u.getRoles().isEmpty())
                            ? u.getRoles().iterator().next().getName()
                            : null;

                    return UserSummaryDTO.builder()
                            .id(u.getId())
                            .email(u.getEmail())
                            .fullName(u.getFullName())
                            .phone(u.getPhone())
                            .roleName(roleName)
                            .build();
                })
                .toList();

        // Tính tổng nhân sự đệ quy: số user gán trực tiếp + tổng nhân sự của các nút con
        int directUsersCount = userSummaries.size();
        int childrenUsersCount = childrenNodes.stream()
                .mapToInt(LocationTreeDTO::getTotalUsers)
                .sum();
        int totalCalculated = directUsersCount + childrenUsersCount;

        Long parentId = (loc.getParent() != null) ? loc.getParent().getId() : null;

        return LocationTreeDTO.builder()
                .id(loc.getId())
                .code(loc.getCode())
                .name(loc.getName())
                .path(loc.getPath())
                .level(loc.getLevel())
                .status(loc.getStatus())
                .users(userSummaries)
                .totalUsers(totalCalculated)
                .children(childrenNodes)
                .build();
    }

    private void normalize(LocationDTO request) {
        if (request.getCode() != null) {
            request.setCode(request.getCode().trim());
        }
        if (request.getName() != null) {
            request.setName(request.getName().trim());
        }
    }

    private Location resolveParent(Long parentId, Long currentId, ValidationContext ctx) {
        if (parentId == null) {
            return null;
        }

        if (parentId.equals(currentId)) {
            ctx.add("parentLocationId", "A location cannot be its own parent");
            return null;
        }

        Location parent = locationRepository.findById(parentId).orElse(null);
        if (parent == null) {
            ctx.add("parentLocationId", "Parent location does not exist");
            return null;
        }

        if (currentId != null) {
            Location cursor = parent;
            while (cursor != null) {
                if (Objects.equals(cursor.getId(), currentId)) {
                    ctx.add("parentLocationId", "Parent location cannot be a descendant of this location");
                    return null;
                }
                cursor = cursor.getParent();
            }
        }

        return parent;
    }

    @Transactional
    public void assignUserToLocation(Long locationId, String email) {
        Location location = locationRepository.findById(locationId)
                .orElseThrow(() -> new IllegalArgumentException("Location not found"));
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User with email " + email + " not found"));

        location.addUser(user);
        locationRepository.save(location);
    }

    @Transactional
    public void unassignUserFromLocation(Long locationId, Long userId) {
        Location location = locationRepository.findById(locationId)
                .orElseThrow(() -> new IllegalArgumentException("Location not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (location.getUsers() != null) {
            location.getUsers().remove(user);
        }
        locationRepository.save(location);
    }
}