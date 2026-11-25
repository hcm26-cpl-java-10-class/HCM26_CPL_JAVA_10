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
  Bot,
  CheckCircle2,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
      <section className="mx-auto grid w-full max-w-7xl min-w-0 gap-4 pb-5">
        <header className="flex flex-col justify-between gap-3 rounded-xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 via-background to-sky-50/70 p-4 dark:border-indigo-900/60 dark:from-indigo-950/30 dark:to-sky-950/20 sm:flex-row sm:items-center sm:p-5">
          <div className="min-w-0">
            <Badge className="mb-2 gap-1.5 border-indigo-200 bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
              <Bot className="size-3.5" /> AI Template Generator
            </Badge>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Generate a project template</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Share your project brief to create a structured first draft with milestones, backlog, modules, and resources.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild type="button" variant="outline" size="sm">
              <Link to="/ai-assistant/suggestions"><ClipboardList className="size-4" />Review suggestions</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/project-templates")}>
              <ArrowLeft className="size-4" /> Project templates
            </Button>
          </div>
        </header>

        <section className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="min-w-0 overflow-hidden border-indigo-200/70 pt-0 shadow-sm dark:border-indigo-900/60">
            <CardHeader className="gap-1 border-b bg-indigo-50/50 px-4 py-3 dark:bg-indigo-950/30">
              <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="size-4 text-indigo-600 dark:text-indigo-400" />Project brief</CardTitle>
              <CardDescription className="text-xs">Fields marked * are required.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 py-4">
              <form onSubmit={submit} noValidate aria-busy={mutation.isPending} className="grid gap-3.5">
                <div className="grid min-w-0 gap-1.5">
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
                  <p className="text-right text-[11px] text-muted-foreground">{values.projectTitle.length}/200</p>
                </div>
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="ai-project-type">Project type <span className="text-destructive">*</span></Label>
                  <Input
                    id="ai-project-type"
                    value={values.projectType}
                    onChange={(event) => change("projectType", event.target.value)}
                    placeholder="Web, mobile, data platform..."
                    required
                    disabled={mutation.isPending}
                  />
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="ai-project-description">Project description <span className="text-destructive">*</span></Label>
                    <span className="text-[11px] text-muted-foreground">{values.projectDescription.length}/5000</span>
                  </div>
                  <Textarea
                    id="ai-project-description"
                    value={values.projectDescription}
                    onChange={(event) => change("projectDescription", event.target.value)}
                    maxLength={5000}
                    rows={4}
                    placeholder="Describe the problem, users, objectives, and key features."
                    required
                    disabled={mutation.isPending}
                    className="field-sizing-fixed h-32 min-h-32 max-h-32 resize-none overflow-y-auto overscroll-contain"
                  />
                </div>

                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="ai-additional-requirements">Additional requirements <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <span className="text-[11px] text-muted-foreground">{values.additionalRequirements.length}/3000</span>
                  </div>
                  <Textarea
                    id="ai-additional-requirements"
                    value={values.additionalRequirements}
                    onChange={(event) => change("additionalRequirements", event.target.value)}
                    maxLength={3000}
                    rows={3}
                    placeholder="Preferred technologies, constraints, or special expectations..."
                    disabled={mutation.isPending}
                    className="field-sizing-fixed h-24 min-h-24 max-h-24 resize-none overflow-y-auto overscroll-contain"
                  />
                </div>

                {(validationError || mutation.isError) && (
                  <Alert variant="destructive" role="alert">
                    <AlertCircle />
                    <AlertTitle>Generation failed</AlertTitle>
                    <AlertDescription>{validationError || errorMessage(mutation.error)}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/25 transition-shadow hover:from-indigo-500 hover:to-violet-500 hover:shadow-md" disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
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
              <div className="min-w-0 space-y-3">
                <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 via-background to-teal-50/70 shadow-sm dark:border-emerald-900 dark:from-emerald-950/40 dark:to-teal-950/20">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                    <div className="flex min-w-0 items-start gap-3">
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="min-w-0">
                        <h2 className="font-semibold leading-tight text-emerald-900 dark:text-emerald-200">Suggestion generated</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-mono font-semibold text-emerald-800 dark:text-emerald-300">#{result.suggestionId}</span>
                          {" · "}<span className="font-semibold text-emerald-700 dark:text-emerald-300">{result.status}</span>
                          {" · "}{result.model || "AI model"} · {formatCreatedAt(result.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button asChild size="sm" className="h-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500">
                        <Link to={`/ai-assistant/suggestions/${result.suggestionId}`}>Review suggestion</Link>
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-8 border-emerald-300 bg-white/70 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50" onClick={reset}>New</Button>
                    </div>
                  </CardContent>
                </Card>
                <AiTemplateResult output={result.output} />
              </div>
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
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    <Bot className="size-7" />
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
