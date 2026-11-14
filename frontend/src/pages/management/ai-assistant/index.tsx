import { aiAssistantApi } from "@/api/features/ai-assistant.api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MainLayout } from "@/components/layout/MainLayout";
import type { GenerateTemplateResponse } from "@/types/features/ai-assistant";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AiTemplateResult } from "./components/AiTemplateResult";

interface GenerateFormValues {
  projectTitle: string;
  projectDescription: string;
  projectType: string;
  additionalRequirements: string;
}

type ApiErrorBody = {
  message?: unknown;
  error?: unknown;
  errors?: unknown;
};

const initialValues: GenerateFormValues = {
  projectTitle: "",
  projectDescription: "",
  projectType: "",
  additionalRequirements: "",
};

function errorMessage(error: unknown): string {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
  }

  const body = error.response?.data;
  if (body && typeof body === "object") {
    const messages: string[] = [];
    if (typeof body.message === "string" && body.message.trim()) messages.push(body.message);
    if (typeof body.error === "string" && body.error.trim() && !messages.includes(body.error)) messages.push(body.error);
    if (body.errors && typeof body.errors === "object") {
      Object.values(body.errors as Record<string, unknown>).forEach((value) => {
        if (typeof value === "string") messages.push(value);
        else if (Array.isArray(value)) {
          value.forEach((item) => {
            if (typeof item === "string") messages.push(item);
          });
        }
      });
    }
    if (messages.length) return [...new Set(messages)].join(" ");
  }

  return error.message || "Could not generate a project template. Please try again.";
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AiAssistantPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [result, setResult] = useState<GenerateTemplateResponse | null>(null);
  const [validationError, setValidationError] = useState("");

  const mutation = useMutation({
    mutationFn: aiAssistantApi.generateTemplate,
    onSuccess: (response) => {
      setResult(response);
      setValidationError("");
    },
  });

  const change = (field: keyof GenerateFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setValidationError("");
    if (mutation.isError) mutation.reset();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const projectTitle = values.projectTitle.trim();
    const projectDescription = values.projectDescription.trim();
    const projectType = values.projectType.trim();

    if (!projectTitle || !projectDescription || !projectType) {
      setValidationError("Complete the required fields before generating a suggestion.");
      return;
    }
    if (projectTitle.length > 200 || projectDescription.length > 5000 || values.additionalRequirements.length > 3000) {
      setValidationError("One or more fields exceed the maximum allowed length.");
      return;
    }

    setValidationError("");
    setResult(null);
    mutation.mutate({
      projectTitle,
      projectDescription,
      projectType,
      additionalRequirements: values.additionalRequirements.trim() || undefined,
    });
  };

  const reset = () => {
    mutation.reset();
    setResult(null);
    setValues(initialValues);
    setValidationError("");
  };

  return (
    <MainLayout pathName={{ "ai-assistant": "AI Template Generator" }}>
      <section className="mx-auto grid w-full max-w-6xl min-w-0 gap-6 pb-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <Badge variant="secondary" className="gap-1.5"><Sparkles className="size-3.5" /> AI Assistant</Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Generate a project template</h1>
            <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
              Describe the project and let AI draft a structured template with milestones, team constraints, backlog, modules, and resources.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => navigate("/project-templates")}>
            <ArrowLeft className="size-4" /> Project templates
          </Button>
        </header>

        <section className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <Card className="min-w-0 overflow-hidden pt-0">
            <CardHeader className="border-b bg-indigo-50/50 pt-5 dark:bg-indigo-950/30">
              <CardTitle className="flex items-center gap-2"><ClipboardList className="size-5 text-indigo-600 dark:text-indigo-400" />Project brief</CardTitle>
              <CardDescription>Provide enough context to generate a useful first draft.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={submit} noValidate aria-busy={mutation.isPending} className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="ai-project-title">Project title <span className="text-destructive">*</span></Label>
                  <Input
                    id="ai-project-title"
                    value={values.projectTitle}
                    onChange={(event) => change("projectTitle", event.target.value)}
                    maxLength={200}
                    placeholder="E.g. Campus Event Management Platform"
                    required
                    disabled={mutation.isPending}
                  />
                  <p className="text-right text-xs text-muted-foreground">{values.projectTitle.length}/200</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ai-project-description">Project description <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="ai-project-description"
                    value={values.projectDescription}
                    onChange={(event) => change("projectDescription", event.target.value)}
                    maxLength={5000}
                    rows={6}
                    placeholder="Describe the problem, users, objectives, and key features."
                    required
                    disabled={mutation.isPending}
                    className="resize-y"
                  />
                  <p className="text-right text-xs text-muted-foreground">{values.projectDescription.length}/5000</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ai-project-type">Project type <span className="text-destructive">*</span></Label>
                  <Input
                    id="ai-project-type"
                    value={values.projectType}
                    onChange={(event) => change("projectType", event.target.value)}
                    placeholder="E.g. Web application, mobile app, data platform"
                    required
                    disabled={mutation.isPending}
                  />
                  <p className="text-xs text-muted-foreground">Use a type that best describes the solution you want to build.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ai-additional-requirements">Additional requirements</Label>
                  <Textarea
                    id="ai-additional-requirements"
                    value={values.additionalRequirements}
                    onChange={(event) => change("additionalRequirements", event.target.value)}
                    maxLength={3000}
                    rows={4}
                    placeholder="Optional: preferred technologies, constraints, or special expectations."
                    disabled={mutation.isPending}
                    className="resize-y"
                  />
                  <p className="text-right text-xs text-muted-foreground">{values.additionalRequirements.length}/3000</p>
                </div>

                {(validationError || mutation.isError) && (
                  <Alert variant="destructive" role="alert">
                    <AlertCircle />
                    <AlertTitle>Generation failed</AlertTitle>
                    <AlertDescription>{validationError || errorMessage(mutation.error)}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {mutation.isPending ? "Generating suggestion..." : "Generate project template"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="min-w-0 space-y-4" aria-live="polite">
            {mutation.isPending ? (
              <Card role="status" aria-label="Processing project template generation" className="border-indigo-200 dark:border-indigo-900">
                <CardContent className="grid justify-items-center gap-4 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <Loader2 className="size-7 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <Badge variant="secondary">PROCESSING</Badge>
                    <h2 className="text-lg font-semibold">Building your project template</h2>
                    <p className="max-w-md text-sm text-muted-foreground">
                      The request is being validated and sent to the AI provider. This may take a little while.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : result ? (
              <>
                <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                      <div className="min-w-0">
                        <h2 className="font-semibold">Suggestion generated</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Suggestion #{result.suggestionId} · {result.status} · {result.model || "AI model"} · {formatCreatedAt(result.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={reset}>Generate another</Button>
                  </CardContent>
                </Card>
                <AiTemplateResult output={result.output} />
              </>
            ) : mutation.isError ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <AlertCircle className="mx-auto size-8 text-destructive" />
                  <h2 className="mt-3 font-semibold">We couldn’t complete the generation</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Review the error message and your project brief, then try again.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="grid justify-items-center gap-3 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Sparkles className="size-6" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Your generated template will appear here</h2>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      Submit a project brief to preview the template suggestion returned by AI.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </section>
    </MainLayout>
  );
}
