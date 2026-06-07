import type { ReactNode } from "react";
interface Props { children: ReactNode; maxWidth?: string; padding?: string; }
export default function PageContainer({ children, maxWidth="1400px", padding="22px 28px" }: Props) {
  return(
    <div style={{ maxWidth, margin: "0 auto", padding }}>
      {children}
    </div>
  );
}