export const APP_NAME    = "CivicConnect";
export const APP_VERSION = "1.0.0";
export const DEPARTMENTS = ["Electricity","Water Works","Sanitation","Roads & Infrastructure","Police","Fire Department","General Civic"] as const;
export const ROLES       = ["citizen","officer","worker","admin"] as const;
export const STATUS_LIST = ["Pending","Assigned","Resolved"] as const;
export const EMERGENCY_NUMBERS = { police:"100", fire:"101", ambulance:"108", emergency:"112", helpline:"1800-425-0082" };
export const AP_DISTRICTS = ["Visakhapatnam","Vizianagaram","Srikakulam","East Godavari","West Godavari","Konaseema","Kakinada","Eluru","Krishna","NTR","Guntur","Bapatla","Palnadu","Prakasam","Nellore","Kurnool","Nandyal","Anantapur","Sri Sathya Sai","YSR Kadapa","Chittoor","Tirupati"] as const;