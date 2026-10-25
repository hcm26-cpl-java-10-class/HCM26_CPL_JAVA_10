package com.example.starter_project_2025.system.project.milestone.risk;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
/** Namespaced UUID aliases for the UUID milestone contract; authorization always uses real DB IDs. */
public final class MilestoneRiskIdentity {
    private MilestoneRiskIdentity() { }
    public static UUID tenant(Long id) { return alias("tenant", id); }
    public static UUID actor(Long id) { return alias("user", id); }
    private static UUID alias(String type, Long id) {
        return UUID.nameUUIDFromBytes(("fams:milestone:" + type + ":" + id).getBytes(StandardCharsets.UTF_8));
    }
}
