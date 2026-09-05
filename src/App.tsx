import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AuthSession, Bill, CompanyDatabase, CompanyProfile, NavigationRoute, UserAccount } from './types';
import { FirebaseService, SUPER_ADMIN_EMAIL, auth, db, runFirebaseDiagnostic } from './services/firebase';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import { SimulatorView } from './components/SimulatorView';
import { BillsView } from './components/BillsView';
import { CalendarView } from './components/CalendarView';
import { PurchasesHistoryView } from './components/PurchasesHistoryView';
import { SuppliersView } from './components/SuppliersView';
import { SettingsView } from './components/SettingsView';
import { LicencasAdminView } from './components/LicencasAdminView';
import { MasterPanelView } from './components/MasterPanelView';
import { Loader2 } from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserAccount | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<CompanyDatabase | null>(null);
  const [currentRoute, setCurrentRoute] = useState<NavigationRoute>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const isSuperAdmin = currentUser?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() || userProfile?.role === 'master';

  // Monitor Firebase Auth state & Real-time User Profile Listener
  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    // Check stored Master session on mount
    try {
      const storedMaster = localStorage.getItem('fluxo_master_session');
      if (storedMaster) {
        const parsed = JSON.parse(storedMaster);
        const masterUser: FirebaseUser = {
          uid: parsed.uid || 'master_admin_rogerio_uid',
          email: SUPER_ADMIN_EMAIL,
          displayName: 'Administrador Master',
        } as unknown as FirebaseUser;

        setCurrentUser(masterUser);
        setUserProfile({
          uid: masterUser.uid,
          email: SUPER_ADMIN_EMAIL,
          name: 'Administrador Master',
          companyId: 'master',
          companyName: 'Painel Central Master',
          role: 'master',
          department: 'Administração Geral',
          status: 'ATIVO',
          approvalStatus: 'approved',
          licenseDays: 365,
          expiresAt: '2099-12-31',
          createdAt: new Date().toISOString(),
          lastAccessAt: new Date().toISOString(),
        });
        setActiveCompanyId('master_default');
        setCurrentRoute('master-dashboard');
        setIsAuthChecking(false);
      } else {
        const storedStore = localStorage.getItem('fluxo_store_session');
        if (storedStore) {
          const parsed = JSON.parse(storedStore);
          const storeUser: FirebaseUser = {
            uid: parsed.uid,
            email: parsed.email,
            displayName: parsed.name || 'Usuário da Loja',
          } as unknown as FirebaseUser;

          setCurrentUser(storeUser);
          if (parsed.companyId) {
            setActiveCompanyId(parsed.companyId);
            FirebaseService.getUserProfile(parsed.uid).then((p) => {
              if (p) setUserProfile(p);
            });
          }
          setIsAuthChecking(false);
        }
      }
    } catch (e) {
      console.warn('Error reading stored session:', e);
    }

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      // Check stored store or master sessions first
      const storedMaster = localStorage.getItem('fluxo_master_session');
      const storedStore = localStorage.getItem('fluxo_store_session');

      if (storedMaster) {
        try {
          const parsed = JSON.parse(storedMaster);
          const masterUser: FirebaseUser = {
            uid: parsed.uid || 'master_user',
            email: parsed.email || SUPER_ADMIN_EMAIL,
            displayName: parsed.name || 'Administrador Master',
          } as unknown as FirebaseUser;
          setCurrentUser(masterUser);
          setUserProfile({
            uid: masterUser.uid,
            email: parsed.email || SUPER_ADMIN_EMAIL,
            name: parsed.name || 'Administrador Master',
            companyId: 'master',
            companyName: 'Painel Central Master',
            role: 'master',
            department: 'Administração Geral',
            status: 'ATIVO',
            approvalStatus: 'approved',
            licenseDays: 365,
            expiresAt: '2099-12-31',
            createdAt: new Date().toISOString(),
            lastAccessAt: new Date().toISOString(),
          });
          // Master role safely uses master_default for global control when storeId is null or 'master'
          setActiveCompanyId('master_default');
          runFirebaseDiagnostic(masterUser);
        } catch {}
        setIsAuthChecking(false);
        return;
      }

      if (storedStore) {
        try {
          const parsed = JSON.parse(storedStore);
          const storeUser: FirebaseUser = {
            uid: parsed.uid,
            email: parsed.email,
            displayName: parsed.name || 'Usuário da Loja',
          } as unknown as FirebaseUser;
          setCurrentUser(storeUser);

          if (parsed.companyId && parsed.companyId !== 'master') {
            setActiveCompanyId(parsed.companyId);
          }

          if (profileUnsub) {
            profileUnsub();
            profileUnsub = null;
          }

          // Real-time listener for store user profile document
          const userDocRef = doc(db, 'users', parsed.uid);
          profileUnsub = onSnapshot(
            userDocRef,
            (snap) => {
              if (snap.exists()) {
                const data = snap.data() as UserAccount;
                setUserProfile({ ...data, uid: parsed.uid });
                if (data.role === 'master' || FirebaseService.isMasterEmail(parsed.email)) {
                  // Master handles null/undefined/master store ID safely
                  setActiveCompanyId((prev) => prev || 'master_default');
                } else if (data.companyId && data.companyId !== 'master') {
                  setActiveCompanyId(data.companyId);
                }
              }
              runFirebaseDiagnostic(storeUser);
              setIsAuthChecking(false);
            },
            (err) => {
              console.warn('Error syncing store user profile:', err);
              runFirebaseDiagnostic(storeUser);
              setIsAuthChecking(false);
            }
          );
        } catch {}
        setIsAuthChecking(false);
        return;
      }

      if (user && !user.isAnonymous) {
        setCurrentUser(user);
        if (profileUnsub) {
          profileUnsub();
          profileUnsub = null;
        }

        // Listen to user profile document in real-time
        const userDocRef = doc(db, 'users', user.uid);
        profileUnsub = onSnapshot(
          userDocRef,
          async (snap) => {
            if (snap.exists()) {
              const data = snap.data() as UserAccount;
              setUserProfile({ ...data, uid: user.uid });
              const isMaster = data.role === 'master' || FirebaseService.isMasterEmail(user.email);
              if (isMaster) {
                setActiveCompanyId((prev) => (prev && prev !== 'master' ? prev : 'master_default'));
              } else if (data.companyId && data.companyId !== 'master') {
                setActiveCompanyId(data.companyId);
              }
            } else {
              // User document was not found by Auth UID. Look up via email fallback or company profile
              const fallbackProf = await FirebaseService.getUserProfile(user.uid, user.email);
              if (fallbackProf) {
                setUserProfile({ ...fallbackProf, uid: user.uid });
                // Link profile to auth UID so subsequent direct lookups hit immediately
                try {
                  await setDoc(doc(db, 'users', user.uid), { ...fallbackProf, uid: user.uid }, { merge: true });
                } catch {}
                const isMaster = fallbackProf.role === 'master' || FirebaseService.isMasterEmail(user.email);
                if (isMaster) {
                  setActiveCompanyId((prev) => (prev && prev !== 'master' ? prev : 'master_default'));
                } else if (fallbackProf.companyId && fallbackProf.companyId !== 'master') {
                  setActiveCompanyId(fallbackProf.companyId);
                }
              } else {
                setUserProfile(null);
                if (FirebaseService.isMasterEmail(user.email)) {
                  setActiveCompanyId('master_default');
                }
              }
            }
            runFirebaseDiagnostic(user);
            setIsAuthChecking(false);
          },
          async (err) => {
            console.warn('Error listening to direct user profile, checking fallback:', err);
            const fallbackProf = await FirebaseService.getUserProfile(user.uid, user.email);
            if (fallbackProf) {
              setUserProfile(fallbackProf);
              if (fallbackProf.companyId && fallbackProf.companyId !== 'master') {
                setActiveCompanyId(fallbackProf.companyId);
              }
            }
            if (FirebaseService.isMasterEmail(user.email)) {
              setActiveCompanyId('master_default');
            }
            runFirebaseDiagnostic(user);
            setIsAuthChecking(false);
          }
        );
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setActiveCompanyId(null);
        setCompanyData(null);
        setIsAuthChecking(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  // Real-time Firestore synchronization whenever activeCompanyId is set
  useEffect(() => {
    if (!activeCompanyId || activeCompanyId === 'master' || activeCompanyId === 'master_default') {
      // Default fallback profile for Master when not inspecting a specific company
      if (isSuperAdmin) {
        setCompanyData({
          profile: {
            id: 'master_control',
            name: 'Painel Central Master',
            cnpj: '00.000.000/0001-00',
            phone: '(00) 00000-0000',
            address: 'Central de Operações',
            dailyLimit: 0,
            monthlyLimit: 0,
            protectedDay: 20,
            status: 'ATIVA',
            createdAt: new Date().toISOString(),
          },
          bills: [],
          purchases: [],
          suppliers: [],
          collaborators: [],
        });
      }
      return;
    }

    let isSubscribed = true;

    // Subscribe to real-time company document and all subcollections
    const unsubscribe = FirebaseService.subscribeToCompanyData(
      activeCompanyId,
      (data) => {
        if (!isSubscribed) return;

        const updatedProfile: CompanyProfile = {
          ...data.profile,
          id: activeCompanyId,
          status: data.profile.status || 'ATIVA',
          dailyLimit: Number(data.profile.dailyLimit || 0),
          monthlyLimit: Number(data.profile.monthlyLimit || 0),
          protectedDay: Number(data.profile.protectedDay || 20),
        };

        // Trigger immediate state update across all components with fresh references
        setCompanyData({
          profile: updatedProfile,
          bills: [...data.bills],
          purchases: [...data.purchases],
          suppliers: [...data.suppliers],
          collaborators: [...data.collaborators],
        });

        // Instantly synchronize store status in userProfile state across all active devices
        setUserProfile((prev) => {
          if (!prev) return prev;
          if (prev.storeStatus !== updatedProfile.status) {
            return {
              ...prev,
              storeStatus: updatedProfile.status,
            };
          }
          return prev;
        });
      },
      (error) => {
        console.warn(`[Firestore Realtime] Sync notice for store ${activeCompanyId}:`, error);
      }
    );

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [activeCompanyId, isSuperAdmin]);

  const handleAuthSuccess = (user: FirebaseUser, companyId: string, profile?: UserAccount) => {
    setCurrentUser(user);
    if (profile) {
      setUserProfile(profile);
    }
    const isMaster = FirebaseService.isMasterEmail(user.email);
    if (isMaster) {
      setActiveCompanyId(companyId || 'master_default');
      setCurrentRoute('master-dashboard');
    } else {
      setActiveCompanyId(companyId);
      setCurrentRoute('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('fluxo_master_session');
      localStorage.removeItem('fluxo_store_session');
    } catch {}
    await FirebaseService.logout();
    setCurrentUser(null);
    setUserProfile(null);
    setActiveCompanyId(null);
    setCompanyData(null);
    setIsSidebarOpen(false);
    setCurrentRoute('dashboard');
  };

  const handlePayBillDirectly = async (bill: Bill) => {
    if (!companyData || !activeCompanyId || activeCompanyId.startsWith('master')) return;
    const today = new Date().toISOString().split('T')[0];
    await FirebaseService.updateBill(companyData.profile.id, bill.id, {
      status: 'Pago',
      paidAt: today,
      paidAmount: bill.amount,
    });
  };

  const isApproved = isSuperAdmin || (userProfile && userProfile.approvalStatus === 'approved');

  // Build a session object compatible with UI components
  const currentSession: AuthSession | null = currentUser ? {
    uid: currentUser.uid,
    email: currentUser.email || 'usuario@fluxo.com',
    name: userProfile?.name || currentUser.displayName || (isSuperAdmin ? 'Administrador Master' : 'Usuário'),
    companyId: activeCompanyId || 'master',
    role: isSuperAdmin ? 'master' : (userProfile?.role || 'admin'),
    companyName: companyData?.profile.name || userProfile?.companyName || (isSuperAdmin ? 'Painel Master' : 'Minha Empresa'),
    isSuperAdmin,
    isMaster: isSuperAdmin,
    storeStatus: companyData?.profile.status || 'ATIVA',
    approvalStatus: userProfile?.approvalStatus || (isSuperAdmin ? 'approved' : 'pending'),
    licenseDays: userProfile?.licenseDays,
    expiresAt: userProfile?.expiresAt,
  } : null;

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center text-teal-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            Conectando ao Firebase Firestore...
          </span>
        </div>
      </div>
    );
  }

  // If unauthenticated or user is still waiting for approval, show AuthView
  if (!currentUser || !isApproved || !companyData || !currentSession) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#050810] text-slate-100 flex flex-col antialiased selection:bg-teal-400 selection:text-slate-950">
      {/* Sidebar Navigation */}
      <Sidebar
        currentRoute={currentRoute}
        isOpen={isSidebarOpen}
        session={currentSession}
        profile={companyData.profile}
        collaboratorsCount={companyData.collaborators.length}
        onClose={() => setIsSidebarOpen(false)}
        onNavigate={(route) => setCurrentRoute(route)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col flex-1 min-w-0 transition-all duration-300">
        {/* Top Navigation Bar */}
        <Navbar
          currentRoute={currentRoute}
          session={currentSession}
          profile={companyData.profile}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNavigate={(route) => setCurrentRoute(route)}
          onOpenQuickPurchase={() => setCurrentRoute('simulador')}
        />

        {/* View Router */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Master Controller Routes */}
          {currentRoute === 'master-dashboard' && isSuperAdmin && (
            <MasterPanelView session={currentSession} initialTab="dashboard" />
          )}

          {currentRoute === 'master-lojas' && isSuperAdmin && (
            <MasterPanelView session={currentSession} initialTab="lojas" />
          )}

          {currentRoute === 'master-usuarios' && isSuperAdmin && (
            <MasterPanelView session={currentSession} initialTab="usuarios" />
          )}

          {currentRoute === 'master-atividades' && isSuperAdmin && (
            <MasterPanelView session={currentSession} initialTab="atividades" />
          )}

          {currentRoute === 'licencas-admin' && isSuperAdmin && (
            <LicencasAdminView session={currentSession} />
          )}

          {/* Store Routes */}
          {currentRoute === 'dashboard' && (
            <DashboardView
              data={companyData}
              onNavigate={(route) => setCurrentRoute(route)}
              onPayBill={handlePayBillDirectly}
            />
          )}

          {currentRoute === 'simulador' && (
            <SimulatorView
              data={companyData}
              onNavigate={(route) => setCurrentRoute(route)}
            />
          )}

          {currentRoute === 'contas' && (
            <BillsView
              data={companyData}
            />
          )}

          {currentRoute === 'calendario' && (
            <CalendarView
              data={companyData}
            />
          )}

          {currentRoute === 'compras-lista' && (
            <PurchasesHistoryView
              data={companyData}
              onNavigate={(route) => setCurrentRoute(route)}
            />
          )}

          {currentRoute === 'fornecedores' && (
            <SuppliersView
              data={companyData}
            />
          )}

          {currentRoute === 'config' && (
            <SettingsView
              data={companyData}
              session={currentSession}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

