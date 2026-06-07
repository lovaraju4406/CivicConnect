import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import complaintReducer from "./complaintSlice";
import notificationReducer from "./notificationSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    complaints: complaintReducer,
    notifications: notificationReducer,
  },
});

export type RootState = any;
export type AppDispatch = typeof store.dispatch;