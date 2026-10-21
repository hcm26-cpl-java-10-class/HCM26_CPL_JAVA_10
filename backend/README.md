# Running locally

Requires JDK 21 and Node.js. The `local` Spring profile provides sample classes,
trainers and rooms without requiring the shared API on port 9090. It also creates
an ACTIVE Java program with three subjects and assigns it to the first sample
class. The second sample class is available to try assigning a program.

From `backend/`, run:

```powershell
# Use your installed JDK 21 path if JAVA_HOME points to another version.
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
mvn.cmd spring-boot:run '-Dspring-boot.run.profiles=local'
```

From `frontend/`, run `npm.cmd run dev`, then open
<http://localhost:5173/class-setup>. Sign in as `admin@example.com` with the
local seed password `password123`. The page displays a sample-data notice.
Local data uses an in-memory H2 database and is reset when the backend stops.

## Connecting the shared service

Run without the `local` profile and set `EXTERNAL_API_BASE_URL` (default
`http://localhost:9090`) and `EXTERNAL_API_TOKEN` when needed. The shared service
must expose `GET /api/classes`, `GET /api/classes/{id}`, `GET /api/trainers`, and
`GET /api/rooms`. Class and trainer lists accept the `status` query parameter.
This mode does not silently substitute sample data if the shared service fails.
