import React from "react";
import { Container } from "./container";

const PAD = {
  tight: "py-16 md:py-20",
  normal: "py-20 md:py-28",
  loose: "py-24 md:py-36",
} as const;

export function SectionFrame({
  id,
  pad = "normal",
  width = "wide",
  hairline = true,
  className = "",
  children,
}: {
  id?: string;
  pad?: keyof typeof PAD;
  width?: "narrow" | "mid" | "wide" | "max";
  hairline?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`relative ${PAD[pad]} ${
        hairline ? "border-t border-sn-hairline" : ""
      } ${className}`}
    >
      <Container width={width}>{children}</Container>
    </section>
  );
}
