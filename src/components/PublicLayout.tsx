import { Outlet } from "react-router-dom";

export const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
};
