import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { LoaderCircle } from "lucide-react";
import { classSetupApi, type SharedTrainer } from "@/api/features/class-setup.api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { validateTrainerProfile } from "../new-trainer-form";

export function NewTrainerFields({ id, initial, readOnly = false, onSaved, onDraftChange, onBusy }: {
  id: string; initial?: { name: string; email?: string | null }; readOnly?: boolean;
  onSaved: (trainer: SharedTrainer) => void; onDraftChange: () => void; onBusy: (busy: boolean) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [saved, setSaved] = useState(false);
  const sending = useRef(false);
  const mutation = useMutation({ mutationFn: classSetupApi.saveAssignmentTrainer, retry: false,
    onSuccess: trainer => { setSaved(true); onSaved(trainer); },
    onSettled: () => { sending.current = false; onBusy(false); },
  });
  function changed() { setErrors({}); setSaved(false); mutation.reset(); onDraftChange(); }
  function save() {
    if (readOnly || sending.current || mutation.isPending) return;
    const next = validateTrainerProfile(name, email); setErrors(next);
    if (Object.keys(next).length) return;
    sending.current = true; onBusy(true);
    mutation.mutate({ name: name.trim(), email: email.trim() });
  }
  const message = axios.isAxiosError(mutation.error) ? mutation.error.response?.data?.message : undefined;
  return <div className="space-y-3" aria-label="Trainer profile">
    <div className="space-y-2"><Label htmlFor={`${id}-name`}>Trainer name *</Label>
      <Input id={`${id}-name`} value={name} readOnly={readOnly} maxLength={200} placeholder="Enter trainer name" aria-invalid={Boolean(errors.name)}
        aria-describedby={errors.name ? `${id}-name-error` : undefined} onChange={e => { setName(e.target.value); changed(); }} />
      {errors.name && <p id={`${id}-name-error`} className="text-sm text-destructive">{errors.name}</p>}</div>
    <div className="space-y-2"><Label htmlFor={`${id}-email`}>Trainer email *</Label>
      <Input id={`${id}-email`} type="email" value={email} readOnly={readOnly} maxLength={200} placeholder="Enter trainer email" aria-invalid={Boolean(errors.email)}
        aria-describedby={errors.email ? `${id}-email-error` : undefined} onChange={e => { setEmail(e.target.value); changed(); }} />
      {errors.email && <p id={`${id}-email-error`} className="text-sm text-destructive">{errors.email}</p>}</div>
    {!readOnly && <Button type="button" variant="outline" disabled={mutation.isPending || saved} onClick={save}>
      {mutation.isPending && <LoaderCircle className="size-4 animate-spin" />}{saved ? "Trainer saved" : "Save trainer"}
    </Button>}
    {saved && <p role="status" className="text-xs text-muted-foreground">Trainer is ready for this assignment.</p>}
    {mutation.isError && <p role="alert" className="text-sm text-destructive">{typeof message === "string" ? message : "Unable to save trainer. Check the name and email and try again."}</p>}
  </div>;
}
