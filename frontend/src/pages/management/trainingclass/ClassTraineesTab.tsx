import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Props {
    classId: number;
}

interface DemoTrainee {
    id: string;
    classId: number;
    code: string;
    name: string;
    email: string;
}

type Scenario = "success" | "empty" | "error";

const mockEnabled =
    import.meta.env.DEV &&
    import.meta.env.VITE_DEV1_TRAINEES_MOCK === "true";

export default function ClassTraineesTab({ classId }: Props) {
    const [scenario, setScenario] = useState<Scenario>("success");
    const [rows, setRows] = useState<DemoTrainee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);

    useEffect(() => {
        if (!mockEnabled) return;

        setRows([]);
        setError("");
        setLoading(true);

        const timer = window.setTimeout(() => {
            if (scenario === "error") {
                setError("Unable to load trainees. Please try again.");
            } else if (scenario === "success") {
                setRows([
                    {
                        id: `demo-${classId}-1`,
                        classId,
                        code: `DEMO-${classId}-001`,
                        name: "Alex Nguyen",
                        email: `alex.class${classId}@example.com`,
                    },
                    {
                        id: `demo-${classId}-2`,
                        classId,
                        code: `DEMO-${classId}-002`,
                        name: "Sam Tran",
                        email: `sam.class${classId}@example.com`,
                    },
                ]);
            }

            setLoading(false);
        }, 400);

        return () => window.clearTimeout(timer);
    }, [classId, scenario, reload]);

    if (!mockEnabled) {
        return (
            <p role="status" className="text-sm text-muted-foreground">
                Trainee data is currently unavailable.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Trainees</h2>
                    <Badge variant="secondary">Demo data</Badge>
                </div>

                <div className="flex items-center gap-2">
                    <label
                        htmlFor="trainee-demo-scenario"
                        className="text-sm text-muted-foreground"
                    >
                        Demo scenario
                    </label>

                    <select
                        id="trainee-demo-scenario"
                        value={scenario}
                        onChange={(event) =>
                            setScenario(event.target.value as Scenario)
                        }
                        className="rounded-md border bg-background px-3 py-2 text-sm"
                    >
                        <option value="success">With trainees</option>
                        <option value="empty">Empty list</option>
                        <option value="error">Load error</option>
                    </select>
                </div>
            </div>

            <p className="text-sm text-muted-foreground">
                Sample trainees for class {classId}. This is not live
                enrollment data.
            </p>

            {loading && <p role="status">Loading trainees...</p>}

            {!loading && error && (
                <div role="alert" className="space-y-3">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button
                        variant="outline"
                        onClick={() => setReload((value) => value + 1)}
                    >
                        Retry
                    </Button>
                </div>
            )}

            {!loading && !error && rows.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    No trainees found in this demo scenario.
                </p>
            )}

            {!loading && !error && rows.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Trainee Code</TableHead>
                                <TableHead>Full Name</TableHead>
                                <TableHead>Email</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {rows.map((row, index) => (
                                <TableRow
                                    key={row.id}
                                    className="odd:bg-accent even:bg-background"
                                >
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-medium">
                                        {row.code}
                                    </TableCell>
                                    <TableCell>{row.name}</TableCell>
                                    <TableCell>{row.email}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}