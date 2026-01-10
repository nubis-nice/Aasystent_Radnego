import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background shadow-sm hover:shadow-md active:scale-[0.98]";

  const variantClasses = {
    primary:
      "bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 shadow-primary-500/20 hover:shadow-primary-500/30",
    secondary:
      "bg-secondary-100 text-secondary-900 hover:bg-secondary-200 border border-secondary-200",
    outline: "border-2 border-primary-500 text-primary-600 hover:bg-primary-50",
    ghost:
      "hover:bg-secondary-100 text-secondary-700 hover:text-secondary-900 shadow-none",
  };

  const sizeClasses = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 py-2.5 px-6 text-sm",
    lg: "h-12 px-8 text-base",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
