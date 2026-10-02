"use client";

import React, { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <span className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full rounded-md border border-[#E4E1DA] bg-white px-3.5 py-2 text-sm text-[#171717] placeholder:text-[#6B6B67] focus:border-[#B7791F] focus:outline-none focus:ring-2 focus:ring-[#B7791F]/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            leftIcon ? "pl-9" : undefined,
            rightIcon ? "pr-9" : undefined,
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 text-slate-400 dark:text-slate-500 flex items-center">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
