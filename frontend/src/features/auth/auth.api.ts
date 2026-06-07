// Wire to backend after integration
export const authApi = {
  login:    async (email:string,password:string,role:string) => { /* backend: POST /auth/login */ return null; },
  register: async (data:any) => { /* backend: POST /auth/register */ return null; },
  me:       async () => { /* backend: GET /auth/me */ return null; },
  logout:   async () => { /* backend: POST /auth/logout */ },
};