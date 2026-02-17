import { Route } from "react-router-dom";
import EmployeeHomeView from "@/features/access/employee/views/EmployeeHomeView";

import ProfileView from "@/features/account/views/ProfileView";
import SecurityView from "@/features/account/views/SecurityView";
import SettingsView from "@/features/account/views/SettingsView";

export default function EmployeeRoutes() {
  return (
    <Route path="/app">
      <Route index element={<EmployeeHomeView />} />
      <Route path="profile" element={<ProfileView />} />
      <Route path="security" element={<SecurityView />} />
      <Route path="settings" element={<SettingsView />} />
    </Route>
  );
}
