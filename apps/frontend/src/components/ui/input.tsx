import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={`flex h-11 w-full rounded-xl border-2 border-secondary-200 bg-white px-4 py-2.5 text-sm font-medium text-text transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-secondary-400 hover:border-secondary-300 focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-secondary-50 ${className}`}
      {...props}
    />
  );
}
