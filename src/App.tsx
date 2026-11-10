import React, { useState, useEffect, useCallback } from 'react';
import { ScreenKey } from './types';
import { Sidebar } from './components/Sidebar';
import { TableroView } from './views/TableroView';
import { SolicitudesView } from './views/SolicitudesView';
import { ClientesView } from './views/ClientesView';
import { ProgramacionView } from './views/ProgramacionView';
import { BandejaView } from './views/BandejaView';
import { DictamenesView } from './views/DictamenesView';
import { ConaguaView } from './views/ConaguaView';
import { EstadisticasView } from './views/EstadisticasView';
import { FormatosView } from './views/FormatosView';
import { InstrumentosView } from './views/InstrumentosView';
import { VerificadoresView } from './views/VerificadoresView';
import { UsuariosView } from './views/UsuariosView';
import { AltaFormatoView } from './views/AltaFormatoView';
import { EditorView } from './views/EditorView';
import { TiposView } from './views/TiposView';
import { PreviewView } from './views/PreviewView';
import { CalibracionView } from './views/CalibracionView';
import { PrestamosView } from './views/PrestamosView';
import { RevisionView } from './views/RevisionView';
import { ExpedienteView } from './views/ExpedienteView';
import { ProcesoView } from './views/ProcesoView';
import { PerfilView } from './views/PerfilView';
import { LogoutDialog, SignedOutScreen } from './components/SessionScreens';
import { UserMenu } from './components/UserMenu';
import { CheckCircle2, LogOut, X } from 'lucide-react';

export default function App() {
  const getScreenFromHash = (): ScreenKey => {
    const hash = window.location.hash.replace('#', '');
    const validScreens: ScreenKey[] = [
      'Tablero',
      'Solicitudes',
      'Clientes',
      'Programacion',
      'Bandeja',
      'Dictamenes',
      'Conagua',
      'Estadisticas',
      'Main',
      'Instrumentos',
      'Verificadores',
      'Usuarios',
      'AltaFormato',
      'Editor',
      'Tipos',
      'Preview',
      'Calibracion',
      'Prestamos',
      'Revision',
      'Expediente',
      'Proceso',
      'Perfil'
    ];
    if (validScreens.includes(hash as ScreenKey)) {
      return hash as ScreenKey;
    }
    return 'Tablero';
  };

  const [currentScreen, setCurrentScreen] = useState<ScreenKey>(getScreenFromHash);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signedOut, setSignedOut] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('uva.signedOut') === '1';
    } catch {
      return false;
    }
  });

  const requestLogout = useCallback(() => {
    setIsSidebarOpen(false);
    setConfirmLogout(true);
  }, []);
  const cancelLogout = useCallback(() => setConfirmLogout(false), []);

  const doLogout = () => {
    // Sin SSO todavía: la sesión es local. Con Entra ID aquí se redirigirá al endpoint de logout del gateway.
    try {
      sessionStorage.setItem('uva.signedOut', '1');
    } catch {
      /* almacenamiento no disponible */
    }
    setConfirmLogout(false);
    setToastMessage(null);
    setSignedOut(true);
    window.location.hash = '';
  };

  const doSignIn = () => {
    try {
      sessionStorage.removeItem('uva.signedOut');
    } catch {
      /* almacenamiento no disponible */
    }
    setSignedOut(false);
    window.location.hash = '#Tablero';
    setCurrentScreen('Tablero');
  };

  useEffect(() => {
    const handleHashChange = () => {
      const screen = getScreenFromHash();
      setCurrentScreen(screen);
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (screen: ScreenKey) => {
    window.location.hash = `#${screen}`;
    setCurrentScreen(screen);
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const renderCurrentView = () => {
    switch (currentScreen) {
      case 'Tablero':
        return <TableroView onNavigate={navigateTo} />;
      case 'Solicitudes':
        return <SolicitudesView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Clientes':
        return <ClientesView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Programacion':
        return <ProgramacionView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Bandeja':
        return <BandejaView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Dictamenes':
        return <DictamenesView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Conagua':
        return <ConaguaView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Estadisticas':
        return <EstadisticasView onShowToast={showToast} />;
      case 'Main':
        return <FormatosView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Instrumentos':
        return <InstrumentosView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Verificadores':
        return <VerificadoresView onShowToast={showToast} />;
      case 'Usuarios':
        return <UsuariosView onShowToast={showToast} />;
      case 'AltaFormato':
        return <AltaFormatoView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Editor':
        return <EditorView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Tipos':
        return <TiposView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Preview':
        return <PreviewView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Calibracion':
        return <CalibracionView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Prestamos':
        return <PrestamosView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Revision':
        return <RevisionView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Expediente':
        return <ExpedienteView onNavigate={navigateTo} onShowToast={showToast} />;
      case 'Proceso':
        return <ProcesoView onNavigate={navigateTo} />;
      case 'Perfil':
        return <PerfilView onNavigate={navigateTo} onShowToast={showToast} onLogout={requestLogout} />;
      default:
        return <TableroView onNavigate={navigateTo} />;
    }
  };

  if (signedOut) {
    return <SignedOutScreen onSignIn={doSignIn} />;
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-dvh bg-canvas text-ink-900">
      {/* Responsive Sidebar */}
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={navigateTo}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={requestLogout}
      />

      {/* Main View Area */}
      <main className="flex-1 min-w-0 flex flex-col bg-canvas [&>*]:w-full [&>*]:min-w-0">
        {/* Desktop top bar: account menu at top-right */}
        <header className="hidden lg:flex print:hidden items-center justify-end gap-2 h-14 px-6 lg:px-8 border-b border-line-200 bg-canvas">
          <UserMenu onProfile={() => navigateTo('Perfil')} onLogout={requestLogout} />
          <span className="w-px h-6 bg-line-300" aria-hidden="true" />
          <button
            type="button"
            onClick={requestLogout}
            className="h-9 px-3 rounded-lg text-xs font-semibold text-ink-700 hover:text-danger-700 hover:bg-danger-50 inline-flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </header>
        {renderCurrentView()}
      </main>

      {confirmLogout && <LogoutDialog onCancel={cancelLogout} onConfirm={doLogout} />}

      {/* Global Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-5 sm:right-5 z-[60] flex items-center gap-3 bg-side-900 text-white px-4 py-3 rounded-xl shadow-lg border border-side-600 sm:max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-5 h-5 text-accent-300 shrink-0" />
          <span className="text-xs font-medium leading-snug flex-1">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-side-400 hover:text-white p-0.5"
            aria-label="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
