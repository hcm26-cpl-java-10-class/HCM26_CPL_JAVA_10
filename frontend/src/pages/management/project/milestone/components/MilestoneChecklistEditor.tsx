import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetFocus,
} from "react-hook-form";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MILESTONE_FORM_LIMITS, type MilestoneFormValues } from "../milestone-form.schema";

interface MilestoneChecklistEditorProps {
  control: Control<MilestoneFormValues>;
  errors: FieldErrors<MilestoneFormValues>;
  register: UseFormRegister<MilestoneFormValues>;
  setFocus: UseFormSetFocus<MilestoneFormValues>;
  submitting: boolean;
}

function FieldMessage({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="text-sm text-destructive">{message}</p> : null;
}

export function MilestoneChecklistEditor({
  control,
  errors,
  register,
  setFocus,
  submitting,
}: MilestoneChecklistEditorProps) {
  const { fields, append, remove, move } = useFieldArray({ control, name: "checklist" });
  const checklistValues = useWatch({ control, name: "checklist" }) ?? [];
  const atItemLimit = fields.length >= MILESTONE_FORM_LIMITS.checklistItems;

  const addChecklistItem = () => {
    if (atItemLimit || submitting) return;

    const nextIndex = fields.length;
    append({ content: "", mandatory: true });
    requestAnimationFrame(() => setFocus(`checklist.${nextIndex}.content`));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Acceptance checklist</CardTitle>
          <Badge variant="outline">
            {fields.length} / {MILESTONE_FORM_LIMITS.checklistItems} items
          </Badge>
        </div>
        <CardDescription>Conditions the team must satisfy for delivery acceptance.</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3">
        {fields.map((field, index) => {
          const contentLength = checklistValues[index]?.content?.length ?? 0;
          const contentAtLimit = contentLength >= MILESTONE_FORM_LIMITS.checklistItemContent;
          const contentNearLimit = contentLength >= MILESTONE_FORM_LIMITS.checklistItemContent * 0.9;
          const contentError = errors.checklist?.[index]?.content?.message;
          const inputId = `milestone-checklist-${index}`;
          const counterId = `${inputId}-counter`;
          const errorId = `${inputId}-error`;

          return (
            <div key={field.id} className="grid gap-3 rounded-xl border bg-muted/10 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {index + 1}
                </div>
                <Label htmlFor={inputId} className="font-medium">
                  Item name {index + 1} <span className="text-destructive">*</span>
                </Label>

                <div className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move acceptance condition ${index + 1} up`}
                    disabled={index === 0 || submitting}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move acceptance condition ${index + 1} down`}
                    disabled={index === fields.length - 1 || submitting}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    aria-label={`Delete acceptance condition ${index + 1}`}
                    disabled={fields.length === 1 || submitting}
                    onClick={() => remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>

              <Input
                id={inputId}
                required
                maxLength={MILESTONE_FORM_LIMITS.checklistItemContent}
                placeholder="Enter the acceptance checklist item name"
                aria-invalid={!!contentError}
                aria-describedby={`${counterId}${contentError ? ` ${errorId}` : ""}`}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && index === fields.length - 1) {
                    event.preventDefault();
                    addChecklistItem();
                  }
                }}
                {...register(`checklist.${index}.content`)}
              />

              <FieldMessage id={errorId} message={contentError} />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Controller
                  control={control}
                  name={`checklist.${index}.mandatory`}
                  render={({ field: itemField }) => (
                    <Label htmlFor={`${inputId}-mandatory`} className="flex w-fit items-center gap-2 text-sm font-normal text-muted-foreground">
                      <Checkbox
                        id={`${inputId}-mandatory`}
                        checked={itemField.value}
                        onCheckedChange={(checked) => itemField.onChange(checked === true)}
                      />
                      Mandatory
                    </Label>
                  )}
                />

                <span
                  id={counterId}
                  className={contentAtLimit
                    ? "text-xs font-medium text-destructive"
                    : contentNearLimit
                      ? "text-xs font-medium text-amber-600 dark:text-amber-400"
                      : "text-xs text-muted-foreground"}
                >
                  {contentAtLimit ? "Character limit reached · " : ""}
                  {contentLength} / {MILESTONE_FORM_LIMITS.checklistItemContent}
                </span>
              </div>
            </div>
          );
        })}

        <FieldMessage
          id="milestone-checklist-error"
          message={typeof errors.checklist?.message === "string" ? errors.checklist.message : undefined}
        />

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full border-dashed"
          onClick={addChecklistItem}
          disabled={atItemLimit || submitting}
        >
          {!atItemLimit ? <Plus className="size-4" /> : null}
          {atItemLimit ? `Maximum ${MILESTONE_FORM_LIMITS.checklistItems} items reached` : "Add checklist item"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Press Enter in the last item to add another checklist item.
        </p>
      </CardContent>
    </Card>
  );
}
