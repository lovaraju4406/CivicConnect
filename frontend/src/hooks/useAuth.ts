import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../store";
import { logout } from "../store/authSlice";
import { clearComplaints } from "../store/complaintSlice";
import { clearNotifications } from "../store/notificationSlice";

export function useAuth() {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const user       = useSelector((s: RootState) => s.auth.user);
  const isLoggedIn = useSelector((s: RootState) => s.auth.isAuthenticated);

  const signOut = () => {
    dispatch(clearComplaints());
    dispatch(clearNotifications());
    dispatch(logout());
    navigate("/login");
  };

  return { user, isLoggedIn, signOut };
}

// Default export — fixes "does not provide an export named 'default'" crash
export default useAuth;