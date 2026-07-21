import React, { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import Onboarding from './screens/Onboarding';
import ImportWizard from './screens/ImportWizard';
import PhotoCapture from './screens/PhotoCapture';
import Dashboard from './screens/Dashboard';
import Inventory from './screens/Inventory';
import ProductDetail from './screens/ProductDetail';
import ActionCenter from './screens/ActionCenter';
import SalesScreen from './screens/SalesScreen';
import SalesIntelligence from './screens/SalesIntelligence';
import Settings from './screens/Settings';
import Sidebar from './components/Sidebar';
import MobileBottomNav from './components/MobileBottomNav';
import { useAuth } from './contexts/AuthContext';
import { useFetch } from './hooks/useApi';
import { api } from './api/client';

export default function MainApp() {
  const { isAuthenticated, token } = useAuth();
  const [appStage, setAppStage] = useState(
    () => localStorage.getItem('inv_appStage') || 'onboarding'
  );
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const { data: actionData } = useFetch(
    isAuthenticated && appStage === 'app' ? '/action-queue' : null
  );
  const actionCount = actionData?.total || 0;

  // Must be before any conditional return (Rules of Hooks)
  const handleNavigateToProduct = useCallback(async (productId) => {
    try {
      const p = await api.get(`/products/${productId}`, token);
      const lots = p.stockLots || [];
      const totalQty = lots.reduce((s, l) => s + (l.quantity || 0), 0);
      const hasConflict = lots.some(l => l.confidenceState === 'conflict_detected');
      const hasVerified = lots.some(l => ['count_verified', 'sales_reconciled'].includes(l.confidenceState));
      const status = hasConflict ? 'unverified' : hasVerified ? 'verified' : 'draft';
      setSelectedProduct({
        ...p,
        name: p.name || 'Unnamed product',
        category: p.category || 'Uncategorized',
        status,
        missingDetails: [
          ...(!p.name ? ['name'] : []),
          ...(!p.sellingPrice ? ['price'] : []),
          ...(!totalQty && lots.length > 0 ? ['quantity'] : []),
        ],
        quantity: totalQty || null,
        price: p.sellingPrice ? parseFloat(p.sellingPrice) : null,
        isDeadStock: totalQty > 0 && !p.sellingPrice && status !== 'verified',
        daysUnmoved: p.daysUnmoved ?? null,
      });
      setCurrentScreen('product');
    } catch {
      setCurrentScreen('inventory');
    }
  }, [token]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const changeStage = (stage) => {
    localStorage.setItem('inv_appStage', stage);
    setAppStage(stage);
  };

  const handleNavigate = (screen) => {
    setSelectedProduct(null);
    setCurrentScreen(screen);
    if (screen === 'photo') changeStage('photo');
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setCurrentScreen('product');
  };

  if (appStage === 'onboarding') {
    const handleOnboardingComplete = (action) => {
      if (action === 'import' || action === 'erp') changeStage('import');
      else changeStage('photo');
    };
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (appStage === 'import') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <ImportWizard onComplete={() => { changeStage('app'); setCurrentScreen('dashboard'); }} />
      </div>
    );
  }

  if (appStage === 'photo') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <PhotoCapture onComplete={() => { changeStage('app'); setCurrentScreen('dashboard'); }} />
      </div>
    );
  }

  const sidebarCurrent = selectedProduct ? 'inventory' : currentScreen;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        current={sidebarCurrent}
        onNavigate={handleNavigate}
        onReset={() => changeStage('onboarding')}
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
            onUpdate={() => handleNavigateToProduct(selectedProduct.id)}
          />
        )}
        {currentScreen === 'actions' && (
          <ActionCenter onNavigate={handleNavigate} onSelectProduct={handleNavigateToProduct} />
        )}
        {currentScreen === 'sales' && <SalesScreen onNavigate={handleNavigate} />}
        {currentScreen === 'sales-intelligence' && <SalesIntelligence onNavigate={handleNavigate} />}
        {(currentScreen === 'settings' || currentScreen === 'integrations') && (
          <Settings key={currentScreen} initialTab={currentScreen === 'integrations' ? 'integrations' : undefined} />
        )}
        <div className="mobile-nav-spacer" />
      </main>
      <MobileBottomNav
        current={sidebarCurrent}
        onNavigate={handleNavigate}
        actionCount={actionCount}
      />
    </div>
  );
}
