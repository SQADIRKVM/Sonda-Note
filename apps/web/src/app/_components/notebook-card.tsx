import React from "react";

interface NotebookCardProps extends React.HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function NotebookCard({
  raised = false,
  children,
  className = "",
  ...props
}: NotebookCardProps) {
  return (
    <div
      className={`rounded-lg border border-sn-hairline ${
        raised ? "bg-sn-surface-raised" : "bg-sn-surface"
      } p-6 hover:border-sn-hairline-strong transition-colors duration-150 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
