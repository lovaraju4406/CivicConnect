import { Component, type ErrorInfo, type ReactNode } from "react";
interface State { hasError:boolean; error?:Error; }
export default class ErrorBoundary extends Component<{children:ReactNode},State> {
  state:State={hasError:false};
  static getDerivedStateFromError(error:Error){return{hasError:true,error};}
  componentDidCatch(error:Error,info:ErrorInfo){console.error("ErrorBoundary caught:",error,info);}
  render(){
    if(this.state.hasError)return(
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",background:"#f8fafc"}}>
        <div style={{textAlign:"center",padding:"48px",maxWidth:"480px"}}>
          <div style={{fontSize:"48px",marginBottom:"16px"}}>💥</div>
          <h1 style={{fontSize:"20px",fontWeight:800,color:"#1e293b",marginBottom:"8px"}}>Something went wrong</h1>
          <p style={{fontSize:"13px",color:"#64748b",marginBottom:"20px"}}>{this.state.error?.message||"An unexpected error occurred."}</p>
          <button onClick={()=>window.location.reload()} style={{padding:"10px 24px",borderRadius:"10px",border:"none",background:"#1d4ed8",color:"#fff",fontSize:"14px",fontWeight:700,cursor:"pointer"}}>Reload Page</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}