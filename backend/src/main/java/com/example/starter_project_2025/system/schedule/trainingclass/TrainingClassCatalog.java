package com.example.starter_project_2025.system.schedule.trainingclass;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;

import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class TrainingClassCatalog {

    private TrainingClassCatalog() {
    }

    public record Option(String value, String label) {
    }

    public record LocationOption(String value, String label, String site) { }

    // DEV 1 reference data; choosing a location does not reserve a room or other resources.
    private static final List<LocationOption> LOCATIONS = List.of(
            new LocationOption("Room A", "Room A", "HCM"),
            new LocationOption("Room B", "Room B", "HCM"),
            new LocationOption("Training room A", "Training room A", "HCM"),
            new LocationOption("Long An - Room A", "Room A (Long An)", "LONG_AN"),
            new LocationOption("Long An - Room B", "Room B (Long An)", "LONG_AN")
    );

    private static final List<Option> SITES = List.of(
            new Option("HCM", "TP.HCM"),
            new Option("LONG_AN", "Long An")
    );

    private static final List<Option> TRAINEE_TYPES = List.of(
            new Option("FRESHER", "Fresher"),
            new Option("INTERN", "Intern")
    );

    private static final List<Option> DELIVERY_FORMATS = List.of(
            new Option("ONLINE", "Online"),
            new Option("OFFLINE", "Offline"),
            new Option("HYBRID", "Hybrid")
    );

    public static List<Option> sites() {
        return SITES;
    }

    public static List<LocationOption> locations() { return LOCATIONS; }

    public static String requireLocation(String value, String site) {
        String selectedSite = requireSite(site);
        String selected = value == null ? "" : value.trim();
        return LOCATIONS.stream()
                .filter(option -> option.site().equals(selectedSite) && option.value().equals(selected))
                .findFirst().map(LocationOption::value)
                .orElseThrow(() -> new BusinessValidationException(Map.of("location",
                        List.of("Select a valid location for the selected site"))));
    }

    public static List<Option> traineeTypes() {
        return TRAINEE_TYPES;
    }

    public static List<Option> deliveryFormats() {
        return DELIVERY_FORMATS;
    }

    public static String requireSite(String value) {
        return requireOption(value, SITES, "Site");
    }

    public static String requireTraineeType(String value) {
        return requireOption(value, TRAINEE_TYPES, "Trainee type");
    }

    public static String requireDeliveryFormat(String value) {
        return requireOption(
                value,
                DELIVERY_FORMATS,
                "Delivery format"
        );
    }

    private static String requireOption(
            String value,
            List<Option> options,
            String fieldName) {

        if (value == null || value.isBlank()) {
            throw new BadRequestException(fieldName + " is required");
        }

        String normalized = value.trim().toUpperCase(Locale.ROOT);

        boolean supported = options.stream()
                .anyMatch(option -> option.value().equals(normalized));

        if (!supported) {
            throw new BadRequestException(
                    fieldName + " is not supported"
            );
        }

        return normalized;
    }
}
