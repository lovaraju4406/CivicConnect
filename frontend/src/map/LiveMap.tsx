import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import ComplaintMarker from "./ComplaintMarker";
import MapLegend from "./MapLegend";
import type { Complaint } from "../types/complaint.types";

interface Props { complaints: Complaint[]; center?: [number,number]; zoom?: number; height?: string; }

export default function LiveMap({ complaints, center=[16.5062,80.6480], zoom=10, height="400px" }: Props) {
  return(
    <div style={{position:"relative",height,borderRadius:"12px",overflow:"hidden",border:"1px solid #e2e8f0"}}>
      <MapContainer center={center} zoom={zoom} style={{width:"100%",height:"100%"}} zoomControl={true}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap"/>
        {complaints.filter(c=>c.lat&&c.lng).map(c=><ComplaintMarker key={c.id} complaint={c}/>)}
      </MapContainer>
      <div style={{position:"absolute",bottom:"10px",right:"10px",zIndex:1000}}>
        <MapLegend/>
      </div>
    </div>
  );
}