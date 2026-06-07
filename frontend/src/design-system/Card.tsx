import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  hoverable?: boolean;
  selected?: boolean;
}

const PAD = { none: "0", sm: "12px", md: "18px 20px", lg: "24px 28px" };

export default function Card({
  children, padding = "md", hoverable = false, selected = false, style, ...rest
}: CardProps) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1.5px solid ${selected ? "#ea6800" : "#e2e8f0"}`,
        borderRadius: "14px",
        padding: PAD[padding],
        boxShadow: selected
          ? "0 0 0 3px rgba(234,104,0,.13)"
          : "0 1px 4px rgba(0,0,0,.04)",
        transition: "box-shadow .2s, border-color .2s, transform .15s",
        cursor: hoverable ? "pointer" : undefined,
        ...style,
      }}
      onMouseEnter={e => {
        if (hoverable && !selected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#ea6800";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,.08)";
        }
      }}
      onMouseLeave={e => {
        if (hoverable && !selected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#e2e8f0";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,.04)";
        }
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
