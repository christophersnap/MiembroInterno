/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import Login from './pages/Login';

import SolicitudCarnet from './pages/SolicitudCarnet';
import VerificarCodigo from './pages/VerificarCodigo';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Socorristas = React.lazy(() => import('./pages/Socorristas'));
const SocorristaProfile = React.lazy(() => import('./pages/SocorristaProfile'));
const NewSocorrista = React.lazy(() => import('./pages/NewSocorrista'));
const GenerarCarnet = React.lazy(() => import('./pages/GenerarCarnet'));
const Cursos = React.lazy(() => import('./pages/Cursos'));
const CursoDetails = React.lazy(() => import('./pages/CursoDetails'));
const Seccionales = React.lazy(() => import('./pages/Seccionales'));
const Directorio = React.lazy(() => import('./pages/Directorio'));
const VerificacionCarnet = React.lazy(() => import('./pages/VerificacionCarnet'));
const Configuracion = React.lazy(() => import('./pages/Configuracion'));
const ActivityLogs = React.lazy(() => import('./pages/ActivityLogs'));
const Accesos = React.lazy(() => import('./pages/Accesos'));
const Vehiculos = React.lazy(() => import('./pages/Vehiculos'));
const Solicitudes = React.lazy(() => import('./pages/Solicitudes'));
const SolicitudesCompra = React.lazy(() => import('./pages/SolicitudesCompra'));
const SolicitudesCombustible = React.lazy(() => import('./pages/SolicitudesCombustible'));
const ForcePasswordReset = React.lazy(() => import('./pages/ForcePasswordReset'));
const Registro = React.lazy(() => import('./pages/Registro'));
const Archivos = React.lazy(() => import('./pages/Archivos'));
const Anuncios = React.lazy(() => import('./pages/Anuncios'));
const Formularios = React.lazy(() => import('./pages/Formularios'));
const PublicFormulario = React.lazy(() => import('./pages/PublicFormulario'));

const ProtectedRoute = ({ children, requiredPermission, anyPermission }: { children: React.ReactNode, requiredPermission?: string, anyPermission?: string[] }) => {
  const { user, permissions, requiresPasswordReset, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requiresPasswordReset) {
    return <ForcePasswordReset />;
  }

  if (requiredPermission && !permissions[requiredPermission]) {
    return <Navigate to="/" />; // Redirect to dashboard if not authorized
  }

  if (anyPermission && !anyPermission.some(p => permissions[p])) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

export default function App() {
  React.useEffect(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 300);
    }
  }, []);

  return (
    <SettingsProvider>
      <AuthProvider>
        <Router>
          <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="text-xl text-gray-500">Cargando aplicación...</div></div>}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/register" element={<Registro />} />
            <Route path="/verificar" element={<VerificarCodigo />} />
            <Route path="/verificar/:carnetId" element={<VerificacionCarnet />} />
            <Route path="/solicitud-carnet" element={<SolicitudCarnet />} />
            <Route path="/f/:slug" element={<PublicFormulario />} />
            <Route path="/formularios/:slug/responder" element={<PublicFormulario />} />

            {/* Authenticated/App Routes */}
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="socorristas" element={<ProtectedRoute requiredPermission="view_socorristas"><Socorristas /></ProtectedRoute>} />
              <Route path="socorristas/nuevo" element={<ProtectedRoute requiredPermission="edit_socorristas"><NewSocorrista /></ProtectedRoute>} />
              <Route path="socorristas/:id" element={<SocorristaProfile />} />
              <Route path="vehiculos" element={<ProtectedRoute requiredPermission="view_vehiculos"><Vehiculos /></ProtectedRoute>} />
              <Route path="solicitudes" element={<ProtectedRoute><Solicitudes /></ProtectedRoute>} />
              <Route path="solicitudes-compra" element={<ProtectedRoute requiredPermission="view_solicitudes_compra"><SolicitudesCompra /></ProtectedRoute>} />
              <Route path="solicitudes-combustible" element={<ProtectedRoute requiredPermission="view_solicitudes_combustible"><SolicitudesCombustible /></ProtectedRoute>} />
              <Route path="carnet" element={<ProtectedRoute requiredPermission="view_carnet"><GenerarCarnet /></ProtectedRoute>} />
              <Route path="cursos" element={<ProtectedRoute requiredPermission="view_cursos"><Cursos /></ProtectedRoute>} />
              <Route path="cursos/:id" element={<ProtectedRoute requiredPermission="view_cursos"><CursoDetails /></ProtectedRoute>} />
              <Route path="formularios" element={<ProtectedRoute requiredPermission="view_formularios"><Formularios /></ProtectedRoute>} />
              <Route path="seccionales" element={<ProtectedRoute requiredPermission="view_seccionales"><Seccionales /></ProtectedRoute>} />
              <Route path="directorio" element={<ProtectedRoute requiredPermission="view_directorio"><Directorio /></ProtectedRoute>} />
              <Route path="configuracion" element={<ProtectedRoute anyPermission={['view_config', 'personalizar_colores']}><Configuracion /></ProtectedRoute>} />
              <Route path="actividad" element={<ProtectedRoute requiredPermission="view_activity"><ActivityLogs /></ProtectedRoute>} />
              <Route path="archivos" element={<ProtectedRoute requiredPermission="view_archivos"><Archivos /></ProtectedRoute>} />
              <Route path="anuncios" element={<ProtectedRoute requiredPermission="view_anuncios"><Anuncios /></ProtectedRoute>} />
              <Route path="accesos" element={<ProtectedRoute requiredPermission="view_accesos"><Accesos /></ProtectedRoute>} />
            </Route>
          </Routes>
        </Suspense>
        </Router>
      </AuthProvider>
    </SettingsProvider>
  );
}
