import { TabsContent } from "@/components/ui/tabs";
import { useState, type ReactNode } from "react";

export function TemplateDraftTab({ value, activeTab, children }: { value: string; activeTab: string; children: ReactNode }) {
  const active = activeTab === value;
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return <TabsContent value={value} forceMount className="data-[state=inactive]:hidden">
    {(active || visited) && children}
  </TabsContent>;
}
