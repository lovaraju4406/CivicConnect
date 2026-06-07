/**
 * useNotifications — Fetches notifications from real backend
 * Polls every 15s for new notifications
 */
import { useState, useEffect, useCallback } from "react";
import { notificationsAPI } from "../services/api";

export function useNotifications(pollInterval = 60000) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [unreadCount,   setUnreadCount]   = useState(0);

  const fetch = useCallback(async () => {
    try {
      const data = await notificationsAPI.getAll();
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setUnreadCount(list.filter((n: any) => !n.is_read).length);
    } catch {
      // silently fail — notifications are non-critical
    }
    setLoading(false);
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  useEffect(() => {
    fetch();
    const iv = setInterval(fetch, pollInterval);
    return () => clearInterval(iv);
  }, [fetch, pollInterval]);

  return { notifications, loading, unreadCount, markRead, markAllRead, refresh: fetch };
}