import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import Onboarding from './screens/Onboarding';
import ImportWizard from './screens/ImportWizard';
import PhotoCapture from './screens/PhotoCapture';
import Dashboard from './screens/Dashboard';
import Inventory from './screens/Inventory';
import ProductDetail from './screens/ProductDetail';
import ActionCenter from './screens/ActionCenter';
import Sidebar from './components/Sidebar';
import { useAuth } from './contexts/AuthContext';

export default function MainApp() {
  const { isAuthenticated } = useAuth();
  const [appStage, setAppStage] = useState(
    () => localStorage.getItem('inv_appStage') || 'onboarding'
  );
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [selectedProduct, setSelectedProduct] = useState(null);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const setStage = (stage) => {
    localStorage.setItem('inv_appStage', stage);
    setAppStage(stage);
  };

  const handleOnboardingComplete = (action) => {
    if (action === 'import') setStage('import');
    else if (action === 'erp')   setStage('import');
    else setStage('photo');
  };

  const handleSetupComplete = () => {
    setStage('app');
    setCurrentScreen('dashboard');
  };

  const handleNavigate = (screen) => {
    setSelectedProduct(null);
    setCurrentScreen(screen);
    if (screen === 'photo') setStage('photo');
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setCurrentScreen('product');
  };

  if (appStage === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (appStage === 'import') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <ImportWizard onComplete={handleSetupComplete} />
      </div>
    );
  }

  if (appStage === 'photo') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <PhotoCapture onComplete={handleSetupComplete} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        current={selectedProduct ? 'inventory' : currentScreen}
        onNavigate={handleNavigate}
        onReset={() => setAppStage('onboarding')}
      />
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {currentScreen === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
        {currentScreen === 'inventory' && !selectedProduct && (
          <Inventory onSelectProduct={handleSelectProduct} onNavigate={handleNavigate} />
        )}
        {currentScreen === 'product' && selectedProduct && (
          <ProductDetail
            product={selectedProduct}
            onBack={() => { setSelectedProduct(null); setCurrentScreen('inventory'); }}
          />
        )}
        {currentScreen === 'actions' && <ActionCenter onNavigate={handleNavigate} />}
      </main>
    </div>
  );
}
