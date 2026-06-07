export interface Notification {
  id: string; message: string; read: boolean; createdAt: number;
  type?: "info"|"success"|"warning"|"error"; relatedId?: string;
}