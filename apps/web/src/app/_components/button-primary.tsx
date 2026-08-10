import React from "react";
import Link from "next/link";
import { Chrome } from "lucide-react";

interface ButtonPrimaryProps {
  href?: string;
  onInvert?: boolean;
  children?: React.ReactNode;
  icon?: boolean;
  className?: string;
  onClick?: () => void;
}

export function ButtonPrimary({
  href = "/login",
  onInvert = false,
  children = "Add to Chrome — free",
  icon = true,
  className = "",
  onClick,
}: ButtonPrimaryProps) {
  const baseClasses =
    "inline-flex items-center justify-center gap-2.5 rounded-[10px] px-5 py-2.5 text-sm font-sans font-medium transition-colors duration-150 focus-visible:outline-none";

  const colorClasses = onInvert
    ? "bg-sn-surface text-sn-ink hover:bg-sn-surface-raised border border-sn-hairline"
    : "bg-sn-invert text-sn-ink-on-invert hover:bg-[#1A1B17] border border-transparent";

  const content = (
    <>
      {icon && <Chrome className="w-4 h-4" />}
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${baseClasses} ${colorClasses} ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={`${baseClasses} ${colorClasses} ${className}`}>
      {content}
    </button>
  );
}
