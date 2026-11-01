import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-ink hover:brightness-110 shadow-sm",
        soft: "bg-brand-soft text-brand hover:brightness-95",
        ghost: "text-ink hover:bg-muted",
        outline: "border border-line bg-surface text-ink hover:bg-muted",
        wa: "bg-wa text-white hover:brightness-105 shadow-sm",
        danger: "bg-sold text-white hover:brightness-105",
      },
      size: {
        sm: "h-9 rounded-full px-4 text-sm",
        md: "h-11 rounded-2xl px-5 text-[15px]",
        lg: "h-13 rounded-2xl px-6 text-base w-full",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(button({ variant, size }), className)} {...props} />;
}

export { button as buttonVariants };
