import { Marker, Popup } from "react-leaflet";
import type { Complaint } from "../types/complaint.types";
const STATUS_COLORS:Record<string,string>={Pending:"#f59e0b",Assigned:"#3b82f6",Resolved:"#10b981"};
interface Props { complaint: Complaint; }
export default function ComplaintMarker({ complaint: c }: Props) {
  return(
    <Marker position={[c.lat, c.lng]}>
      <Popup>
        <div style={{fontFamily:"system-ui,sans-serif",minWidth:"180px"}}>
          <div style={{fontWeight:700,color:"#1e293b",marginBottom:"4px"}}>{c.title}</div>
          <div style={{fontSize:"12px",color:"#64748b",marginBottom:"6px"}}>{c.department}</div>
          <span style={{display:"inline-flex",alignItems:"center",gap:"4px",padding:"2px 8px",borderRadius:"12px",fontSize:"11px",fontWeight:700,background:STATUS_COLORS[c.status]+"22",color:STATUS_COLORS[c.status]}}>
            ● {c.status}
          </span>
          <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"5px"}}>{c.ticketId}</div>
        </div>
      </Popup>
    </Marker>
  );
}