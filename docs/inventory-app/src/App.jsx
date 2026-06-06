import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BrandProvider } from './contexts/BrandContext';
import Login from './screens/Login';
import Signup from './screens/Signup';
import MainApp from './MainApp';

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RedirectIfAuth({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrandProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"  element={<RedirectIfAuth><Login /></RedirectIfAuth>} />
            <Route path="/signup" element={<RedirectIfAuth><Signup /></RedirectIfAuth>} />
            <Route path="/*"      element={<RequireAuth><MainApp /></RequireAuth>} />
          </Routes>
        </BrowserRouter>
      </BrandProvider>
    </AuthProvider>
  );
}
