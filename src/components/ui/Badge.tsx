"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { RiskLevel } from "@/types";
import { RISK_LEVEL_CONFIG } from "@/lib/constants";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const baseStyles = "inline-flex items-center font-medium rounded-full transition-colors border";

  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-0.5 gap-1.5",
  };

  const variantStyles = {
    default:
      "bg-[#171717] text-white border-transparent",
    secondary:
      "bg-[#F7F7F5] text-[#171717] border-[#E4E1DA]",
    outline:
      "text-[#171717] border-[#E4E1DA] bg-white",
    success:
      "bg-[#2F7D5A]/10 text-[#2F7D5A] border-[#2F7D5A]/30",
    warning:
      "bg-[#F3E8D0] text-[#B7791F] border-[#B7791F]/30",
    danger:
      "bg-[#B94A48]/10 text-[#B94A48] border-[#B94A48]/30",
    info:
      "bg-[#F3E8D0]/60 text-[#B7791F] border-[#E4E1DA]",
  };

  return (
    <span
      className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const config = RISK_LEVEL_CONFIG[level] || RISK_LEVEL_CONFIG.medium;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        config.badgeClass
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dotClass)} />
      {config.label}
    </span>
  );
}

export function VerifiedQuoteBadge({ pageNumber }: { pageNumber?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded font-semibold text-[11px] bg-[#2F7D5A]/10 text-[#2F7D5A] border border-[#2F7D5A]/30">
      <span className="w-1.5 h-1.5 rounded-full bg-[#2F7D5A]" />
      Verified Quote{pageNumber ? ` • Pg ${pageNumber}` : ""}
    </span>
  );
}
