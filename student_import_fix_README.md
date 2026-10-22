# Student Import/Export fix

## Files
- `src/main/java/.../base/dataio/importer/annotation/ImportUpsert.java` (new opt-in annotation)
- `src/main/java/.../base/dataio/importer/service/GenericImportService.java` (replace existing file)
- `src/main/java/.../system/management/student/Student.java` (replace existing file, preserving the fields and annotations supplied in chat)

## Behavior
- Only classes annotated with `@ImportUpsert` use upsert; all other entities retain the previous `repository.save(mappedEntity)` import behavior.
- Student records are matched by `studentCode`: create when missing, update importable fields when present.
- An absent column leaves an existing value untouched; a present but blank optional cell clears that field. Required blank values still fail validation in `GenericImportMapper`.
- Student import fields now align with exported headers for Date of Birth, Gender, Address, and Status, in addition to the existing fields.
- Import errors avoid returning the full SQL statement and identify the student code where possible.

## Apply
Copy the files into the matching paths under `backend/src/main/java`. Then run from `backend`:

```powershell
.\mvnw clean compile
.\mvnw spring-boot:run
```

After replacing the code, download the Student import template again. The template generator should use `@ImportField` annotations; the old downloaded template will not change automatically.

Note: the archive supplied for this patch contained the importer source files, not the full project, so the code has not been compiled against the complete project here. If your project uses a different template generator, its source was not included in `3.zip` and may need a small corresponding adjustment.
