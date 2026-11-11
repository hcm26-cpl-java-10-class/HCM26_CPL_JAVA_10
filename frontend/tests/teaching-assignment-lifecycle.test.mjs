import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEndDate, initialEndDate, canEndAssignment, canDeleteUnusedAssignment } from "../src/pages/management/teaching-assignment/assignment-lifecycle.ts";

const assignment={effectiveFrom:"2026-01-01",effectiveTo:"2026-12-31",revision:2};

test("ending allows inclusive boundaries and shortening but not extending or reversed periods",()=>{
  assert.equal(validateEndDate("2026-01-01",assignment),undefined);
  assert.equal(validateEndDate("2026-12-31",assignment),undefined);
  assert.ok(validateEndDate("2025-12-31",assignment));
  assert.ok(validateEndDate("2027-01-01",assignment));
  assert.ok(validateEndDate("2026-02-30",assignment));
  assert.ok(validateEndDate("",assignment));
  assert.equal(validateEndDate("2027-01-01",{...assignment,effectiveTo:null}),undefined);
});

test("default end date stays within future, current and already-ended assignments",()=>{
  assert.equal(initialEndDate(assignment,"2026-10-27"),"2026-10-27");
  assert.equal(initialEndDate(assignment,"2025-10-27"),"2026-01-01");
  assert.equal(initialEndDate(assignment,"2027-10-27"),"2026-12-31");
  assert.equal(initialEndDate({...assignment,effectiveTo:null},"2027-10-27"),"2027-10-27");
});

test("confirmation requires an exact successful end preview with matching revision and date",()=>{
  const request={effectiveTo:"2026-10-31",revision:2};
  const impact={canSave:true,revision:2,effectiveTo:"2026-10-31"};
  assert.equal(canEndAssignment(request,request,impact),true);
  assert.equal(canEndAssignment(request,null,impact),false);
  assert.equal(canEndAssignment(request,request,{...impact,canSave:false}),false);
  assert.equal(canEndAssignment(request,request,{...impact,revision:3}),false);
  assert.equal(canEndAssignment(request,request,{...impact,effectiveTo:"2026-11-30"}),false);
  assert.equal(canEndAssignment({...request,effectiveTo:"2026-11-30"},request,impact),false);
});

test("delete is disabled for any references or an invalid revision even if context is inconsistent",()=>{
  const context={assignment,linkedSessionCount:0,canDelete:true,previouslyUsed:false};
  assert.equal(canDeleteUnusedAssignment(context),true);
  assert.equal(canDeleteUnusedAssignment({...context,linkedSessionCount:1}),false);
  assert.equal(canDeleteUnusedAssignment({...context,canDelete:false}),false);
  assert.equal(canDeleteUnusedAssignment({...context,previouslyUsed:true}),false);
  assert.equal(canDeleteUnusedAssignment({...context,assignment:{...assignment,revision:-1}}),false);
  assert.equal(canDeleteUnusedAssignment({...context,assignment:{...assignment,revision:undefined}}),false);
});
