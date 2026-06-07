import { useState, useEffect } from "react";

interface GeoState { lat: number|null; lng: number|null; address: string; loading: boolean; error: string|null; }

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ lat:null, lng:null, address:"Detecting location…", loading:true, error:null });

  const detect = () => {
    setState(s => ({...s, loading:true, error:null}));
    if (!navigator.geolocation) { setState(s=>({...s,loading:false,error:"Geolocation not supported"})); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          setState({lat,lng,address:data?.display_name||"Address not found",loading:false,error:null});
        } catch { setState({lat,lng,address:`${lat}, ${lng}`,loading:false,error:null}); }
      },
      err => setState(s=>({...s,loading:false,error:err.message||"Location denied"}))
    );
  };

  useEffect(() => { detect(); }, []);
  return { ...state, refresh: detect };
}