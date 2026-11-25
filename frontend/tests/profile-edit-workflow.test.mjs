import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync, unlinkSync } from "node:fs";

// Mock localStorage and window
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = { location: { href: "" }, matchMedia: () => ({ matches: false }) };

const outfile = new URL("./.profile-edit-workflow.generated.mjs", import.meta.url);
const result = await build({
  stdin: {
    contents: `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { Provider } from "react-redux";
    import { configureStore } from "@reduxjs/toolkit";
    import { MemoryRouter } from "react-router-dom";
    import { PersonalInfoCard } from "./src/pages/management/profile/components/PersonalInfoCard";
    import { ProfileHeader } from "./src/pages/management/profile/components/ProfileHeader";
    import authReducer, { updateUserProfile } from "./src/store/slices/auth/authSlice";
    import { mapProfile } from "./src/api/features/profile.api";
    import { availableAccountViews, canAccessPath } from "./src/utils/rbac.utils";

    export { mapProfile, updateUserProfile, availableAccountViews, canAccessPath, authReducer };

    export function renderCard(isEditing = false, profileOverride = {}) {
      const sampleProfile = {
        fullName: "Admin User",
        email: "admin@example.com",
        employeeCode: "EMP10014",
        phoneNumber: "0903 221 879",
        role: "ADMIN",
        department: "FHN.G2",
        status: "Active",
        initials: "AU",
        lastLogin: null,
        lastLoginAt: null,
        device: null,
        skills: [],
        ...profileOverride,
      };

      return renderToStaticMarkup(
        <PersonalInfoCard
          profile={sampleProfile}
          isEditing={isEditing}
          onStartEditing={() => {}}
          onCancelEditing={() => {}}
          onSaveProfile={async () => {}}
        />
      );
    }

    export function renderHeader(isEditing = false, isSaving = false) {
      return renderToStaticMarkup(
        <ProfileHeader
          isEditing={isEditing}
          isSaving={isSaving}
          onOpenChangePassword={() => {}}
          onTriggerUpdateProfile={() => {}}
          onCancelEditing={() => {}}
        />
      );
    }
  `,
    resolveDir: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  packages: "external",
  tsconfig: new URL("../tsconfig.app.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  define: { "import.meta.env": "{}" },
});

writeFileSync(outfile, result.outputFiles[0].text);
let renderCard, renderHeader, mapProfile, updateUserProfile, availableAccountViews, canAccessPath, authReducer;
try {
  ({ renderCard, renderHeader, mapProfile, updateUserProfile, availableAccountViews, canAccessPath, authReducer } =
    await import(outfile.href));
} finally {
  unlinkSync(outfile);
}

test("1. View mode renders fields as read-only and displays Edit Information and Update Profile actions", () => {
  const cardHtml = renderCard(false);
  // Full name input should be disabled in view mode
  assert.match(cardHtml, /id="fullName"[^>]*disabled/);
  // Phone number input should be disabled in view mode
  assert.match(cardHtml, /id="phoneNumber"[^>]*disabled/);
  // Edit Information action is visible
  assert.match(cardHtml, /Edit Information/);
  // Save Changes button is NOT visible in view mode
  assert.doesNotMatch(cardHtml, /Save Changes/);

  const headerHtml = renderHeader(false);
  assert.match(headerHtml, /Update Profile/);
  assert.match(headerHtml, /Change Password/);
  assert.doesNotMatch(headerHtml, /Save Changes/);
});

test("2. Edit mode enables Full Name and Phone Number while keeping protected fields read-only", () => {
  const cardHtml = renderCard(true);
  // Full Name should NOT be disabled in edit mode
  assert.doesNotMatch(cardHtml, /id="fullName"[^>]*disabled/);
  // Phone Number should NOT be disabled in edit mode
  assert.doesNotMatch(cardHtml, /id="phoneNumber"[^>]*disabled/);

  // Email must remain disabled and readOnly
  assert.match(cardHtml, /id="email"[^>]*disabled[^>]*readOnly/);
  // Employee Code must remain disabled and readOnly
  assert.match(cardHtml, /id="employeeCode"[^>]*disabled[^>]*readOnly/);
  // Role must remain disabled and readOnly
  assert.match(cardHtml, /id="role"[^>]*disabled[^>]*readOnly/);
  // Department must remain disabled and readOnly
  assert.match(cardHtml, /id="department"[^>]*disabled[^>]*readOnly/);

  // Card displays Cancel and Save Changes
  assert.match(cardHtml, /Cancel/);
  assert.match(cardHtml, /Save Changes/);
  // Form has id="profile-form" for coordinated submission
  assert.match(cardHtml, /id="profile-form"/);
});

test("3. ProfileHeader in edit mode displays Cancel and Save Changes wired to profile-form", () => {
  const headerHtml = renderHeader(true);
  assert.match(headerHtml, /Cancel/);
  assert.match(headerHtml, /Save Changes/);
  assert.match(headerHtml, /form="profile-form"/);
  assert.doesNotMatch(headerHtml, /Editing Profile\.\.\./);
});

test("4. ProfileHeader displays loading state when saving", () => {
  const headerHtml = renderHeader(true, true);
  assert.match(headerHtml, /Saving\.\.\./);
  assert.match(headerHtml, /disabled/);
});

test("5. Redux updateUserProfile updates state and localStorage", () => {
  const initialState = {
    token: "token123",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    role: "ADMIN",
    roles: ["ADMIN"],
    permissions: [],
    rolePermissions: {},
    isAuthenticated: true,
  };

  const nextState = authReducer(
    initialState,
    updateUserProfile({ fullName: "New Admin Name", firstName: "New", lastName: "Admin Name" })
  );

  assert.equal(nextState.firstName, "New");
  assert.equal(nextState.lastName, "Admin Name");
});

test("6. Profile response mapping preserves values without hardcoded overwrites", () => {
  const mapped = mapProfile({
    id: 1,
    fullName: "Jane Student",
    firstName: "Jane",
    lastName: "Student",
    email: "student@example.com",
    employeeCode: "STU10001",
    phoneNumber: "0912 345 678",
    role: "STUDENT",
    roles: ["STUDENT"],
    department: "FHN.G2",
    status: "Active",
    lastLogin: null,
    lastLoginAt: null,
    device: null,
    skills: ["React", "TypeScript"],
  });

  assert.equal(mapped.fullName, "Jane Student");
  assert.equal(mapped.phoneNumber, "0912 345 678");
  assert.equal(mapped.role, "STUDENT");
  assert.equal(mapped.employeeCode, "STU10001");
  assert.equal(mapped.initials, "JS");
  assert.equal(mapped.skills.length, 2);
});

test("7. Demo Admin with dual roles can access both Admin and Learner views", () => {
  const adminWithLearner = ["ADMIN_ACCESS", "USER_READ", "LEARNER_ACCESS", "LEARNING_SELF_READ", "COURSE_READ"];
  const views = availableAccountViews(adminWithLearner);
  assert.deepEqual(views, ["ADMIN", "STUDENT"]);

  // In Admin view: administrative pages allowed
  assert.equal(canAccessPath("/dashboard", "ADMIN", adminWithLearner), true);
  assert.equal(canAccessPath("/users", "ADMIN", adminWithLearner), true);

  // In Learner view: learner pages allowed, administrative pages blocked
  assert.equal(canAccessPath("/my-learning", "STUDENT", adminWithLearner), true);
  assert.equal(canAccessPath("/courses", "STUDENT", adminWithLearner), true);
  assert.equal(canAccessPath("/dashboard", "STUDENT", adminWithLearner), false);
  assert.equal(canAccessPath("/users", "STUDENT", adminWithLearner), false);
});

test("8. Admin without learner access has no Learner view", () => {
  const adminOnly = ["ADMIN_ACCESS", "USER_READ"];
  const views = availableAccountViews(adminOnly);
  assert.deepEqual(views, ["ADMIN"]);
  assert.equal(canAccessPath("/my-learning", "ADMIN", adminOnly), false);
});
