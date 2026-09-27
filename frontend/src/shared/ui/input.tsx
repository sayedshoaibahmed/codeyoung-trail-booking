import * as React from "react"
import { cn } from "../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            "flex h-12 w-full min-w-0 max-w-full rounded-lg border-2 border-slate-200 bg-white px-3 sm:px-4 py-2 text-base sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
