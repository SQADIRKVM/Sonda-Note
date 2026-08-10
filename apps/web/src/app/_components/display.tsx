import React from "react";

interface DisplayProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "p";
  size?: "h1" | "h2" | "h3" | "sub";
  children: React.ReactNode;
  onInvert?: boolean;
}

export function Display({
  as: Component = "h2",
  size = "h2",
  children,
  onInvert = false,
  className = "",
  ...props
}: DisplayProps) {
  const sizeClasses = {
    h1: "font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.12] tracking-normal",
    h2: "font-serif text-2xl sm:text-3xl lg:text-4xl font-normal leading-[1.15] tracking-normal",
    h3: "font-serif text-xl sm:text-2xl font-normal leading-[1.2]",
    sub: "font-sans text-base sm:text-lg font-normal leading-relaxed text-sn-ink-secondary",
  };

  const textColors = onInvert
    ? "text-sn-ink-on-invert"
    : size === "sub"
    ? "text-sn-ink-secondary"
    : "text-sn-ink";

  return (
    <Component className={`${sizeClasses[size]} ${textColors} ${className}`} {...props}>
      {children}
    </Component>
  );
}
