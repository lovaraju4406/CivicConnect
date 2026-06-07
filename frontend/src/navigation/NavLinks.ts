export const NAV_LINKS = {
  citizen: [
    { path:"/dashboard",        label:"Dashboard",      icon:"🏠" },
    { path:"/submit-complaint", label:"Submit Issue",   icon:"📝" },
    { path:"/my-complaints",    label:"My Complaints",  icon:"📋" },
  ],
  officer: [
    { path:"/officer-dashboard", label:"Dashboard",  icon:"🏠" },
    { path:"/officer-dashboard", label:"All Cases",  icon:"📋" },
  ],
  worker: [
    { path:"/worker-dashboard", label:"My Tasks",   icon:"🔧" },
    { path:"/worker-dashboard", label:"Completed",  icon:"✅" },
  ],
  admin: [
    { path:"/admin-dashboard",  label:"Overview",    icon:"📊" },
    { path:"/admin-dashboard",  label:"Complaints",  icon:"📋" },
    { path:"/admin-dashboard",  label:"Users",       icon:"👥" },
    { path:"/admin-dashboard",  label:"Departments", icon:"🏢" },
  ],
};