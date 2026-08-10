import React from "react";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: "prose" | "narrow" | "mid" | "wide" | "max";
  children: React.ReactNode;
}

export function Container({ width = "max", className = "", children, ...props }: ContainerProps) {
  const widthClasses = {
    prose: "max-w-[552px]",
    narrow: "max-w-[672px]",
    mid: "max-w-[768px]",
    wide: "max-w-[896px]",
    max: "max-w-[1280px]",
  };

  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${widthClasses[width]} ${className}`} {...props}>
      {children}
    </div>
  );
}
