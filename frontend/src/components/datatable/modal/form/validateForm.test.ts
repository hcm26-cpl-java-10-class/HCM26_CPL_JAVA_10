import { describe, expect, it } from "vitest";
import type { FieldSchema } from "@/types";
import { validateForm } from "./validateForm";

describe("validateForm", () => {
  it("requires create-only fields on create but not edit", () => {
    const fields: FieldSchema[] = [
      {
        name: "password",
        label: "Password",
        type: "password",
        required: false,
        validation: { requiredOnCreate: true },
      },
    ];

    expect(validateForm(fields, { password: "" }, { isEdit: false })).toEqual({
      password: ["Password is required"],
    });
    expect(validateForm(fields, { password: "" }, { isEdit: true })).toEqual({});
  });

  it("validates legacy RegExp patterns and structured pattern rules", () => {
    const fields: FieldSchema[] = [
      {
        name: "firstName",
        label: "First name",
        type: "text",
        validation: {
          pattern: /^[\p{L}]+$/u,
          patternMessage: "Use letters only.",
        },
      },
      {
        name: "email",
        label: "Email",
        type: "text",
        validation: {
          pattern: {
            regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: "Enter a valid email address.",
          },
        },
      },
    ];

    expect(
      validateForm(
        fields,
        { firstName: "Lê", email: "student789@example.com" },
        { isEdit: false },
      ),
    ).toEqual({});
    const errors = validateForm(
      fields,
      { firstName: "Lê1", email: "invalid" },
      { isEdit: false },
    );
    expect(errors.firstName).toEqual(["Use letters only."]);
    expect(errors.email).toContain("Enter a valid email address.");
  });
});
