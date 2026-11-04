# Course metadata demo

`course-reference-metadata.json` contains only the 15 Courses records extracted from
`D:\FPT_OJT\course-reference\test-data\course-import-15-courses-150-lessons.xlsx`
(reference commit `fec198c2`). Original names/descriptions are preserved. Each record
contains `name`, `description`, `instructor`, and nullable `thumbnailUrl`. All 15
source thumbnails are blank and represented as JSON null.

These are demo catalog records, not production course data. Sections, lessons,
enrollments and progress are not included. Loading catalog metadata never enrolls
anyone. My Learning remains empty until the authenticated user explicitly enrolls.

## Future manual loading

Do not start a backend or load records until its effective datasource and startup
initializers have been verified and the user approves using an isolated demo database.
The loader does not start any application and cannot verify database identity itself.
Do not point it at an existing shared/persistent database.

After that approval, with the isolated backend already running, use PowerShell:

```powershell
Set-Location 'D:\FPT_OJT\HCM26_CPL_JAVA_10_user-profile-update'
$demoApi = Read-Host 'Verified isolated backend API base URL (including /api)'
$demoToken = Read-Host 'Existing access token' -AsSecureString
# Preview only; requires COURSE_READ. Makes GET requests, never POSTs.
.\scripts\Load-CourseReferenceDemo.ps1 -ApiBaseUrl $demoApi -AccessToken $demoToken
# Only after reviewing the preview; also requires COURSE_CREATE.
.\scripts\Load-CourseReferenceDemo.ps1 -ApiBaseUrl $demoApi -AccessToken $demoToken -Apply -ConfirmIsolatedDatabase
Remove-Variable demoToken
```

The API URL must use HTTPS or HTTP loopback. Obtain the token through the existing
login flow; no credentials or tokens are stored in the script/dataset. All paginated
course names are checked before writing. Existing names are skipped case-insensitively,
even when other fields differ. The loader never updates or deletes records. It stops
on the first failed POST and reports partial success; inspect the server/data before
retrying. A concurrent create is ultimately guarded by the existing unique name constraint.

No schema migration is needed. The unchanged default H2/create-drop configuration
is disposable; metadata loaded there does not survive an application restart.

## Validation without application startup

```powershell
Set-Location frontend
npm run build
node --test scripts/test-course-metadata.mjs
Set-Location ../backend
.\mvnw.cmd '-Dtest=CourseEnrollmentControllerTest' test
```

The backend command selects plain unit tests only, with no Spring context or database.
Frontend tests render real pages with mocked query/router boundaries; they do not
replace future authenticated browser/API verification against an approved demo runtime.
