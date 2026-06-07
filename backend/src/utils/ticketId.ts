// Generates: CIV-20240613-4821
export function generateTicketId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CIV-${date}-${rand}`;
}
