import { test } from "node:test";
import assert from "node:assert/strict";
import { canSaveAssignmentEdit, updateKey, validateAssignmentEdit } from "../src/pages/management/teaching-assignment/assignment-edit.ts";

const request={classId:1,programSubjectId:10,trainerId:2,role:"MAIN",effectiveFrom:"2026-01-01",effectiveTo:"2026-12-31",revision:3};
const form={...request,classId:"1",programSubjectId:"10",trainerId:"2"};
const context={assignment:{...request},classProfile:{id:1,startDate:"2026-01-01",endDate:"2026-12-31"},trainers:[{id:2}],linkedSessionCount:0};

test("save requires a successful preview of exactly the current fields and revision",()=>{
  const impact={canSave:true,revision:3};
  assert.equal(canSaveAssignmentEdit(request,null,impact),false);
  assert.equal(canSaveAssignmentEdit(request,request,undefined),false);
  assert.equal(canSaveAssignmentEdit(request,request,{...impact,canSave:false}),false);
  assert.equal(canSaveAssignmentEdit(request,request,{...impact,revision:4}),false);
  assert.equal(canSaveAssignmentEdit(request,request,impact),true);
  for(const change of [{role:"ASSISTANT"},{trainerId:4},{effectiveTo:"2026-11-30"},{revision:4},{classId:2},{programSubjectId:11}]) {
    assert.equal(canSaveAssignmentEdit({...request,...change},request,impact),false);
  }
});

test("update identity is independent of object property order",()=>{
  assert.equal(updateKey(request),updateKey({...request,revision:3}));
  assert.notEqual(updateKey(request),updateKey({...request,revision:4}));
});

test("edit validation keeps class and subject fixed and validates active trainers and dates",()=>{
  assert.deepEqual(validateAssignmentEdit(form,context),{});
  assert.ok(validateAssignmentEdit({...form,classId:"2"},context).classId);
  assert.ok(validateAssignmentEdit({...form,programSubjectId:"99"},context).programSubjectId);
  assert.ok(validateAssignmentEdit({...form,trainerId:"4"},context).trainerId);
  assert.ok(validateAssignmentEdit({...form,effectiveTo:"2025-12-31"},context).effectiveTo);
  assert.ok(validateAssignmentEdit({...form,effectiveFrom:"2027-01-01"},context).effectiveFrom);
});
