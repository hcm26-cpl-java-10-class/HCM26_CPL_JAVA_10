package com.example.starter_project_2025.system.demo.session;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;

public record SessionImportRowsRequest(
        @NotEmpty @Size(max = SessionImportService.MAX_ROWS) List<@NotNull @Valid Row> rows) {
    public record Row(@NotNull @Min(2) @Max(1048576) Integer rowNumber,
                      @NotNull @Size(max = 10) Map<@NotBlank @Size(max = 64) String,
                              @Size(max = SessionImportService.MAX_CELL_LENGTH) String> values) {}
}
