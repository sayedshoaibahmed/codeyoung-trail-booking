import * as React from "react"
import { cn } from "../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            'bg-amber-500 text-slate-900 hover:bg-amber-600 font-bold shadow-sm': variant === 'default',
            'bg-red-500 text-white hover:bg-red-600 shadow-sm': variant === 'destructive',
            'border-2 border-teal-900 bg-transparent hover:bg-teal-50 text-teal-900 font-semibold': variant === 'outline',
            'bg-teal-50 text-teal-900 hover:bg-teal-100 font-semibold': variant === 'secondary',
            'hover:bg-teal-50 hover:text-teal-900 text-slate-700': variant === 'ghost',
            'text-teal-700 underline-offset-4 hover:underline font-semibold': variant === 'link',
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3': size === 'sm',
            'h-11 rounded-md px-8': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
