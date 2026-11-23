package com.example.starter_project_2025.system.rbac.location;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LocationDomainTest {

    @Test
    void cannotSetLocationAsOwnParentLocation() {
        Location location = Location.builder().id(1L).code("LOC1").name("Location 1").build();

        assertThrows(IllegalArgumentException.class,
                () -> location.setParentLocation(location));
    }

    @Test
    void changingParentLocationRecalculatesLevelAndPath() {
        Location root = Location.builder().code("ROOT").name("Root").level(0).build();
        Location child = Location.builder().code("CHILD").name("Child").level(0).build();

        root.recalculatePath();
        child.setParentLocation(root);

        assertEquals(1, child.getLevel());
        assertEquals("Root / Child", child.getPath());
    }

    @Test
    void assignAndUnassignUserUsesDomainMethod() {
        Location location = Location.builder().code("LOC1").name("Location 1").build();
        var user = com.example.starter_project_2025.system.rbac.user.User.builder()
                .email("user@example.com")
                .firstName("Test")
                .build();
        location.addUser(user);

        assertEquals(1, location.getUsers().size());
        location.removeUser(user);
        assertEquals(0, location.getUsers().size());
        assertThrows(UnsupportedOperationException.class, location.getUsers()::clear);
    }

    @Test
    void changingStatusAndDescriptionUpdatesTheLocationDomain() {
        Location location = Location.builder()
                .code("LOC1")
                .name("Location 1")
                .description("Old description")
                .status(LocationStatus.ACTIVE)
                .build();

        location.updateInfo("Location 1 Updated", "New description");
        location.changeStatus(LocationStatus.INACTIVE);

        assertEquals("New description", location.getDescription());
        assertEquals(LocationStatus.INACTIVE, location.getStatus());
    }
}
