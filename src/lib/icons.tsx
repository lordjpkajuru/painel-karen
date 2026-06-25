import * as Icons from "lucide-react";
import { LucideProps } from "lucide-react";

export const ICON_OPTIONS = [
  "BarChart3", "FileSpreadsheet", "Link2", "MessageSquare", "Mail", "Bot",
  "Calendar", "Users", "Box", "Zap", "Star", "Globe", "Database", "Settings",
  "Folder", "FileText", "Image", "Video", "Music",
] as const;

export type IconName = (typeof ICON_OPTIONS)[number];

export function DynamicIcon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = (Icons as unknown as Record<string, React.ComponentType<LucideProps>>)[name];
  if (!Cmp) {
    const Fallback = Icons.Box;
    return <Fallback {...props} />;
  }
  return <Cmp {...props} />;
}
