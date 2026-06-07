// Wire to backend after integration
export const dashboardApi = {
  getStats:      async () => { /* backend: GET /dashboard/stats */ return {}; },
  getNearby:     async (lat:number,lng:number) => { /* backend: GET /dashboard/nearby?lat=&lng= */ return []; },
  getAlerts:     async () => { /* backend: GET /dashboard/alerts */ return []; },
};