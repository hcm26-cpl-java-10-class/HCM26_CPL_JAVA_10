# Audit Log: how other features use it

## 1. Show the change history of a record (frontend)

* **Tables built with `ProTable`** get a **History** row action automatically (ADMIN only). The entity type is the
  resource name of the table (`table.permission.resource`), the same name used by the backend audit.
* **Any other page** can use the drop-in button:

```tsx
import { EntityHistoryButton } from "@/components/audit/EntityHistoryButton";

<EntityHistoryButton entityType="BOOK" entityId={book.id} />
```

* The dialog itself is `EntityHistoryDialog`; the data comes from
  `GET /api/audit-logs/entity/{entityType}/{entityId}`.

## 2. Record an action in the audit log (backend)

CRUD (create / update / delete) of every service that extends `BaseCrudServiceImpl` is logged automatically.
For any other business method, add a rule. **The audited service is not modified.**

```java
@Component
public class MyFeatureAuditRules implements AuditRuleProvider {

    @Override
    public List<AuditRule> auditRules() {
        return List.of(
                AuditRule.on("InvitationActionService", "revoke")   // class (simple name), method
                        .action(AuditAction.REVOKE)
                        .entityType("INVITATION")
                        .entityId(call -> String.valueOf(call.arg(0)))
                        .newValue(call -> Map.of("reason", String.valueOf(call.argProp(1, "reason"))))
                        .build());
    }
}
```

* `call.arg(i)`, `call.argProp(i, "field")`, `call.result()`, `call.resultProp("field")`, `call.failed()` read the call.
* `.result(...)` can return `SUCCESS`, `FAILURE` or `PARTIAL` (default: `SUCCESS`, or `FAILURE` if the method threw).
* `.actor(id -> ..., email -> ...)` is only needed before the user is authenticated (login, register...).
* Rules of the existing business actions are in `BusinessAuditRules`.
* New action names: add a constant to `AuditAction`. The UI shows unknown actions with a label derived from the name.
* Never put passwords, tokens or credentials in `oldValue` / `newValue`.

## 3. Statistics

`GET /api/audit-logs/stats?fromDate=&toDate=` feeds the **Statistics** tab of the Audit Log page.
