import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import ReportIssue from "./pages/ReportIssue";
import MyIssues from "./pages/MyIssues";
import MaintenanceIncoming from "./pages/MaintenanceIncoming";
import MaintenanceWork from "./pages/MaintenanceWork";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Student Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/report" element={
              <ProtectedRoute allowedRoles={['student']}>
                <ReportIssue />
              </ProtectedRoute>
            } />
            <Route path="/my-issues" element={
              <ProtectedRoute allowedRoles={['student']}>
                <MyIssues />
              </ProtectedRoute>
            } />

            {/* Maintenance Routes */}
            <Route path="/maintenance/incoming" element={
              <ProtectedRoute allowedRoles={['maintenance']}>
                <MaintenanceIncoming />
              </ProtectedRoute>
            } />
            <Route path="/maintenance/work" element={
              <ProtectedRoute allowedRoles={['maintenance']}>
                <MaintenanceWork />
              </ProtectedRoute>
            } />

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
