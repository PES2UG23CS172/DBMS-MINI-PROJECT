// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Signup from "./components/Signup";
import "./styles.css";
import DashboardEmployee from './components/DashboardEmployee';
import DashboardManager from './components/DashboardManager';
import DashboardHR from './components/DashboardHR';

// Helper function to get user info from localStorage
const getUserInfo = () => {
    const userJson = localStorage.getItem("user");
    return userJson ? JSON.parse(userJson) : null;
};

// Component to handle protected routing and role redirection
const DashboardRedirect = () => {
    const user = getUserInfo();

    if (!user) {
        // This is a safety catch for any unauthorized access to /dashboard/* paths
        return <Navigate to="/login" replace />; 
    }

    // Determine the path based on the user's role
    let dashboardPath = '/dashboard/';
    if (user.role === 'Employee') {
        dashboardPath += 'employee';
    } else if (user.role === 'Manager') {
        dashboardPath += 'manager';
    } else if (user.role === 'HR') {
        dashboardPath += 'hr';
    } else if (user.role === 'System Admin') {
        dashboardPath += 'admin';
    } else {
        // Fallback for an unknown role
        return <Navigate to="/login" replace />;
    }
    
    // Redirect to the appropriate dashboard
    return <Navigate to={dashboardPath} replace />;
};

export default function App() {
    return (
        <Router>
            <Routes>
                
                {/* Public Routes */}
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                
                {/* Role-Specific Dashboard Routes */}
                {/* Note: In a production app, these routes would also use a wrapper component
                   to verify authentication and role access before rendering. */}
                <Route path="/dashboard/employee" element={<DashboardEmployee />} />
                <Route path="/dashboard/manager" element={<DashboardManager />} />
                <Route path="/dashboard/hr" element={<DashboardHR />} />

                {/* === MODIFIED DEFAULT ROUTE: ALWAYS REDIRECTS TO LOGIN === */}
                <Route 
                    path="/" 
                    element={<Navigate to="/login" replace />} 
                />
                
                {/* Fallback Route for non-existent pages (sends them back to the root, which then goes to login) */}
                <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
        </Router>
    );
}