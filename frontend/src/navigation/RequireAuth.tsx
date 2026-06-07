import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../store";

type Props = {
  children: JSX.Element;
};

export default function RequireAuth({ children }: Props) {
  const token = useSelector((state: RootState) => state.auth.token);

  // Not logged in → go to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Logged in → show page
  return children;
}
