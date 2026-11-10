import React, { useEffect } from 'react';
import { ScreenKey } from '../types';
import { UserMenu } from './UserMenu';
import { LEGAL_LINKS } from './legalLinks';
import { 
  LayoutDashboard, 
  FileText, 
  Building2, 
  CalendarClock, 
  ClipboardCheck, 
  Award, 
  UploadCloud, 
  BarChart3, 
  Folders, 
  Gauge, 
  Users, 
  ShieldCheck,
  Menu,
  X,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentScreen: ScreenKey;
  onNavigate: (screen: ScreenKey) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onNavigate,
  isOpen,
  onToggle,
  onClose,
  onLogout
}) => {
  // Map child screen to its parent nav key
  const getActiveKey = (key: ScreenKey): ScreenKey => {
    switch (key) {
      case 'AltaFormato':
      case 'Editor':
      case 'Tipos':
      case 'Preview':
        return 'Main';
      case 'Calibracion':
        return 'Instrumentos';
      case 'Prestamos':
        return 'Programacion';
      case 'Revision':
        return 'Bandeja';
      case 'Expediente':
        return 'Dictamenes';
      case 'Proceso':
        return 'Tablero';
      default:
        return key;
    }
  };

  const activeParent = getActiveKey(currentScreen);

  // Mobile drawer: lock background scroll and close with Escape
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  const operacionItems: { key: ScreenKey; label: string; icon: React.ReactNode; badge?: string }[] = [
    { key: 'Tablero', label: 'Tablero', icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'Solicitudes', label: 'Solicitudes (F-12)', icon: <FileText className="w-4 h-4" />, badge: '6' },
    { key: 'Clientes', label: 'Clientes y aprovechamientos', icon: <Building2 className="w-4 h-4" /> },
    { key: 'Programacion', label: 'Programación de visitas', icon: <CalendarClock className="w-4 h-4" />, badge: '7' },
    { key: 'Bandeja', label: 'Revisión técnica', icon: <ClipboardCheck className="w-4 h-4" />, badge: '3' },
    { key: 'Dictamenes', label: 'Dictámenes y actas', icon: <Award className="w-4 h-4" /> },
    { key: 'Conagua', label: 'Carga a CONAGUA', icon: <UploadCloud className="w-4 h-4" />, badge: '2' },
    { key: 'Estadisticas', label: 'Estadísticas', icon: <BarChart3 className="w-4 h-4" /> }
  ];

  const catalogosItems: { key: ScreenKey; label: string; icon: React.ReactNode }[] = [
    { key: 'Main', label: 'Formatos', icon: <Folders className="w-4 h-4" /> },
    { key: 'Instrumentos', label: 'Instrumentos de medición', icon: <Gauge className="w-4 h-4" /> },
    { key: 'Verificadores', label: 'Verificadores', icon: <Users className="w-4 h-4" /> },
    { key: 'Usuarios', label: 'Usuarios y roles', icon: <ShieldCheck className="w-4 h-4" /> }
  ];

  const handleSelect = (key: ScreenKey) => {
    onNavigate(key);
    onClose();
  };

  return (
    <>
      {/* Mobile Top App Bar */}
      <div className="lg:hidden print:hidden flex items-center justify-between px-4 py-3 bg-side-900 text-white sticky top-0 z-40 border-b border-side-600">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white p-1 shrink-0 shadow-sm ring-1 ring-white/20">
            <img src="/brand/logo-uva.png" alt="Logotipo Sistema UVA" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">Sistema UVA</div>
            <div className="text-[11px] text-side-300">NMX-AA-179-SCFI-2018</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
        <UserMenu tone="dark" showName={false} onProfile={() => handleSelect('Perfil')} onLogout={onLogout} />
        <button
          onClick={onToggle}
          className="p-2 rounded-lg bg-side-700 text-white hover:bg-side-600 transition-colors"
          aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isOpen}
          aria-controls="sidebar-nav"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        </div>
      </div>

      {/* Backdrop for mobile drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        id="sidebar-nav"
        className={`print:hidden fixed lg:sticky top-0 left-0 h-dvh w-72 max-w-[85vw] lg:w-66 bg-side-900 text-side-100 z-50 flex flex-col transition-transform duration-300 ease-in-out shrink-0 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="p-4 pb-3 flex items-center gap-3 border-b border-side-800">
          <div className="w-11 h-11 rounded-xl bg-white p-1.5 shrink-0 shadow-sm ring-1 ring-white/20">
            <img src="/brand/logo-uva.png" alt="Logotipo Sistema UVA" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-[15px] leading-tight truncate">Sistema UVA</h1>
            <p className="text-[11px] text-side-300 font-medium tracking-tight">NMX-AA-179-SCFI-2018</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-2 space-y-4 overflow-y-auto" aria-label="Menú principal">
          <div>
            <span className="block px-3 py-1.5 text-[11px] font-semibold tracking-wider text-side-400 uppercase">
              Operación
            </span>
            <div className="space-y-0.5 mt-1">
              {operacionItems.map((item) => {
                const isActive = activeParent === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelect(item.key)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 lg:py-2 rounded-md text-[13.5px] font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-side-700 text-white font-semibold shadow-xs'
                        : 'text-side-100 hover:bg-side-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className={isActive ? 'text-accent-300' : 'text-side-400'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span
                        className={`text-[11px] font-bold px-1.5 py-px rounded-full tabular-nums ${
                          isActive
                            ? 'bg-accent-300 text-side-900'
                            : 'bg-side-700 text-side-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block px-3 py-1.5 text-[11px] font-semibold tracking-wider text-side-400 uppercase">
              Catálogos
            </span>
            <div className="space-y-0.5 mt-1">
              {catalogosItems.map((item) => {
                const isActive = activeParent === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelect(item.key)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 lg:py-2 rounded-md text-[13.5px] font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-side-700 text-white font-semibold shadow-xs'
                        : 'text-side-100 hover:bg-side-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className={isActive ? 'text-accent-300' : 'text-side-400'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        <div className="lg:hidden p-2 border-t border-side-800">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13.5px] font-medium text-side-100 hover:bg-side-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4 text-side-400" />
            Cerrar sesión
          </button>
        </div>
        <div className="px-4 py-3 border-t border-side-800 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <a href={LEGAL_LINKS.terminos.href} target="_blank" rel="noopener" className="text-side-300 hover:text-white hover:underline">
            Términos y Condiciones
          </a>
          <a href={LEGAL_LINKS.privacidad.href} target="_blank" rel="noopener" className="text-side-300 hover:text-white hover:underline">
            Aviso de Privacidad
          </a>
        </div>
      </aside>
    </>
  );
};
