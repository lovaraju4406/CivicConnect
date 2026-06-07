export const ENV = {
  API_URL:    import.meta.env.VITE_API_URL    || "http://localhost:3001/api",
  SOCKET_URL: import.meta.env.VITE_SOCKET_URL || "http://localhost:3001",
  AI_URL:     import.meta.env.VITE_AI_URL     || "http://localhost:8000",
  MAP_TILE:   "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  IS_DEV:     import.meta.env.DEV,
};
export default ENV;