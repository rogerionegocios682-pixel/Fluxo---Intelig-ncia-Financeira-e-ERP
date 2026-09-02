import {
  AuthSession,
  Bill,
  Collaborator,
  CompanyDatabase,
  CompanyProfile,
  Purchase,
  Supplier,
  UserAccount,
} from '../types';

const ACCOUNTS_KEY = 'fluxo_accounts_v1_5';
const SESSION_KEY = 'fluxo_session_v1_5';
const COMPANY_DATA_PREFIX = 'fluxo_data_';
const COMPANIES_INDEX_KEY = 'fluxo_companies_list_v1_5';

// Helper utilities for date formatting & calculation
export const formatMoney = (val: number): string => {
  return (Number(val) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const parseISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatDateBR = (iso?: string): string => {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return iso;
};

export const addDaysToISO = (iso: string, days: number): string => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export const getTodayISO = (): string => {
  return toISODate(new Date());
};

// Generate unique ID
export const generateId = (prefix = 'id'): string => {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
};

// Initial Clean Database (No mock values)
const getInitialCompanyDatabase = (companyId: string, companyName = 'Minha Empresa'): CompanyDatabase => {
  const profile: CompanyProfile = {
    id: companyId,
    name: companyName,
    tradeName: companyName,
    cnpj: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    logo: '',
    dailyLimit: 0,
    monthlyLimit: 0,
    protectedDay: 20,
    createdAt: new Date().toISOString(),
  };

  return {
    profile,
    bills: [],
    purchases: [],
    suppliers: [],
    collaborators: [],
  };
};

export const StorageService = {
  // ACCOUNTS MANAGEMENT
  getAccounts(): Record<string, UserAccount> {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) {
      // Seed default accounts
      const defaultCompanyId = 'emp_default_mare';
      const initialAccounts: Record<string, UserAccount> = {
        'admin@fluxo.com': {
          email: 'admin@fluxo.com',
          name: 'Carlos Mendes (Admin)',
          password: '123',
          companyId: defaultCompanyId,
          role: 'admin',
          department: 'Diretoria Financeira',
          createdAt: new Date().toISOString(),
        },
        'colaborador@fluxo.com': {
          email: 'colaborador@fluxo.com',
          name: 'Mariana Silva',
          password: '123',
          companyId: defaultCompanyId,
          role: 'collaborator',
          department: 'Contas a Pagar',
          createdAt: new Date().toISOString(),
        },
      };
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(initialAccounts));

      // Seed initial company data
      const db = getInitialCompanyDatabase(defaultCompanyId, 'Caranguejada do Maré');
      localStorage.setItem(`${COMPANY_DATA_PREFIX}${defaultCompanyId}`, JSON.stringify(db));

      // Seed companies index
      localStorage.setItem(
        COMPANIES_INDEX_KEY,
        JSON.stringify([{ id: defaultCompanyId, name: 'Caranguejada do Maré' }])
      );

      return initialAccounts;
    }
    return JSON.parse(raw);
  },

  saveAccount(account: UserAccount): void {
    const accounts = this.getAccounts();
    accounts[account.email.toLowerCase().trim()] = {
      ...account,
      email: account.email.toLowerCase().trim(),
    };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  },

  removeAccount(email: string): void {
    const accounts = this.getAccounts();
    delete accounts[email.toLowerCase().trim()];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  },

  // COMPANIES LIST
  getCompaniesList(): Array<{ id: string; name: string }> {
    this.getAccounts(); // trigger initialization if needed
    const raw = localStorage.getItem(COMPANIES_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  },

  saveCompanyToIndex(company: { id: string; name: string }): void {
    const list = this.getCompaniesList();
    const existingIdx = list.findIndex((c) => c.id === company.id);
    if (existingIdx >= 0) {
      list[existingIdx] = company;
    } else {
      list.push(company);
    }
    localStorage.setItem(COMPANIES_INDEX_KEY, JSON.stringify(list));
  },

  // COMPANY ISOLATED DATABASE
  getCompanyDatabase(companyId: string): CompanyDatabase {
    this.getAccounts(); // ensure seeded
    const raw = localStorage.getItem(`${COMPANY_DATA_PREFIX}${companyId}`);
    if (!raw) {
      const newDb = getInitialCompanyDatabase(companyId, 'Nova Empresa');
      localStorage.setItem(`${COMPANY_DATA_PREFIX}${companyId}`, JSON.stringify(newDb));
      return newDb;
    }
    return JSON.parse(raw);
  },

  saveCompanyDatabase(companyId: string, data: CompanyDatabase): void {
    localStorage.setItem(`${COMPANY_DATA_PREFIX}${companyId}`, JSON.stringify(data));
    if (data.profile?.name) {
      this.saveCompanyToIndex({ id: companyId, name: data.profile.name });
    }
  },

  // AUTH & SESSION
  getCurrentSession(): AuthSession | null {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  },

  setSession(session: AuthSession): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  },

  clearSession(): void {
    sessionStorage.removeItem(SESSION_KEY);
  },

  // REGISTRATION OF NEW COMPANY WITH ADMIN
  registerCompanyWithAdmin(
    companyName: string,
    adminEmail: string,
    adminPass: string,
    adminName: string
  ): { success: boolean; message: string; session?: AuthSession } {
    const accounts = this.getAccounts();
    const cleanEmail = adminEmail.toLowerCase().trim();

    if (accounts[cleanEmail]) {
      return { success: false, message: 'Este email já está cadastrado em outra empresa no sistema.' };
    }

    const companyId = generateId('emp');

    // Create admin account
    const newAdminAccount: UserAccount = {
      email: cleanEmail,
      name: adminName || 'Administrador',
      password: adminPass,
      companyId,
      role: 'admin',
      department: 'Diretoria',
      createdAt: new Date().toISOString(),
    };
    this.saveAccount(newAdminAccount);

    // Initialize company database with this admin in collaborators list
    const newDb = getInitialCompanyDatabase(companyId, companyName);
    newDb.profile.name = companyName;
    newDb.profile.id = companyId;
    newDb.collaborators = [
      {
        id: generateId('colab'),
        name: adminName || 'Administrador',
        email: cleanEmail,
        role: 'admin',
        department: 'Diretoria',
        createdAt: new Date().toISOString(),
      },
    ];

    this.saveCompanyDatabase(companyId, newDb);
    this.saveCompanyToIndex({ id: companyId, name: companyName });

    const session: AuthSession = {
      email: cleanEmail,
      name: adminName || 'Administrador',
      companyId,
      role: 'admin',
      companyName,
    };
    this.setSession(session);

    return { success: true, message: 'Empresa e Administrador cadastrados com sucesso!', session };
  },

  // LOGIN
  login(email: string, pass: string): { success: boolean; message: string; session?: AuthSession } {
    const accounts = this.getAccounts();
    const cleanEmail = email.toLowerCase().trim();
    const acc = accounts[cleanEmail];

    if (!acc) {
      return { success: false, message: 'Usuário não encontrado. Verifique o e-mail digitado ou cadastre sua empresa.' };
    }

    if (acc.password !== pass) {
      return { success: false, message: 'Senha incorreta. Tente novamente.' };
    }

    const db = this.getCompanyDatabase(acc.companyId);
    const session: AuthSession = {
      email: acc.email,
      name: acc.name,
      companyId: acc.companyId,
      role: acc.role,
      companyName: db.profile.name,
    };
    this.setSession(session);

    return { success: true, message: 'Login realizado com sucesso!', session };
  },

  // TEAM / COLLABORATOR MANAGEMENT
  addCollaborator(
    companyId: string,
    data: { name: string; email: string; password: string; role: 'admin' | 'collaborator' | 'financeiro' | 'compras'; department: string }
  ): { success: boolean; message: string } {
    const accounts = this.getAccounts();
    const cleanEmail = data.email.toLowerCase().trim();

    if (accounts[cleanEmail]) {
      return { success: false, message: 'Este e-mail já possui conta no sistema. Utilize outro e-mail.' };
    }

    const db = this.getCompanyDatabase(companyId);

    const newColab: Collaborator = {
      id: generateId('colab'),
      name: data.name,
      email: cleanEmail,
      role: data.role,
      department: data.department || 'Operações',
      createdAt: new Date().toISOString(),
    };

    db.collaborators.push(newColab);
    this.saveCompanyDatabase(companyId, db);

    // Save login credentials linked directly to this companyId
    const newAccount: UserAccount = {
      email: cleanEmail,
      name: data.name,
      password: data.password,
      companyId,
      role: data.role,
      department: data.department,
      createdAt: new Date().toISOString(),
    };
    this.saveAccount(newAccount);

    return { success: true, message: `Colaborador ${data.name} cadastrado com sucesso! Ele já pode fazer login e acessar o banco da empresa.` };
  },

  removeCollaborator(companyId: string, email: string): { success: boolean; message: string } {
    const cleanEmail = email.toLowerCase().trim();
    const db = this.getCompanyDatabase(companyId);

    // Remove from company collaborators
    db.collaborators = db.collaborators.filter((c) => c.email.toLowerCase().trim() !== cleanEmail);
    this.saveCompanyDatabase(companyId, db);

    // Remove login credentials
    this.removeAccount(cleanEmail);

    return { success: true, message: 'Acesso do colaborador revogado e conta removida com sucesso.' };
  },

  // BILLS MANAGEMENT
  addBill(companyId: string, bill: Omit<Bill, 'id' | 'companyId' | 'createdAt'>): Bill {
    const db = this.getCompanyDatabase(companyId);
    const newBill: Bill = {
      ...bill,
      id: generateId('bill'),
      companyId,
      createdAt: new Date().toISOString(),
    };
    db.bills.push(newBill);
    this.saveCompanyDatabase(companyId, db);
    return newBill;
  },

  updateBill(companyId: string, billId: string, updates: Partial<Bill>): void {
    const db = this.getCompanyDatabase(companyId);
    const index = db.bills.findIndex((b) => b.id === billId);
    if (index >= 0) {
      db.bills[index] = { ...db.bills[index], ...updates };
      this.saveCompanyDatabase(companyId, db);
    }
  },

  deleteBill(companyId: string, billId: string): void {
    const db = this.getCompanyDatabase(companyId);
    db.bills = db.bills.filter((b) => b.id !== billId);
    this.saveCompanyDatabase(companyId, db);
  },

  // PURCHASE SIMULATION TO BILLS
  launchSimulatedPurchase(
    companyId: string,
    payload: {
      supplierName: string;
      supplierId?: string;
      totalAmount: number;
      baseDate: string;
      selectedTerms: number[];
      notes?: string;
    }
  ): { purchase: Purchase; billsGenerated: Bill[] } {
    const db = this.getCompanyDatabase(companyId);
    const purchaseId = generateId('pur');
    const partsCount = payload.selectedTerms.length;
    const partAmount = Math.round((payload.totalAmount / partsCount) * 100) / 100;
    const sortedTerms = [...payload.selectedTerms].sort((a, b) => a - b);

    const generatedBills: Bill[] = [];

    sortedTerms.forEach((days, index) => {
      const dueDate = addDaysToISO(payload.baseDate, days);
      const isLast = index === partsCount - 1;
      // Adjust last installment for rounding differences
      const thisAmount = isLast
        ? payload.totalAmount - partAmount * (partsCount - 1)
        : partAmount;

      const bill: Bill = {
        id: generateId('bill'),
        purchaseId,
        companyId,
        supplierId: payload.supplierId,
        supplierName: payload.supplierName || 'Fornecedor Diversos',
        desc: `${payload.supplierName || 'Compra'} (Prazo ${days}d)`,
        amount: thisAmount,
        dueDate,
        status: 'Pendente',
        parcel: `${index + 1}/${partsCount}`,
        notes: payload.notes,
        createdAt: new Date().toISOString(),
      };

      generatedBills.push(bill);
      db.bills.push(bill);
    });

    const newPurchase: Purchase = {
      id: purchaseId,
      companyId,
      supplierId: payload.supplierId,
      supplierName: payload.supplierName || 'Fornecedor Diversos',
      totalAmount: payload.totalAmount,
      date: payload.baseDate,
      termsSelected: sortedTerms,
      installmentsCount: partsCount,
      notes: payload.notes,
      createdAt: new Date().toISOString(),
    };

    db.purchases.push(newPurchase);
    this.saveCompanyDatabase(companyId, db);

    return { purchase: newPurchase, billsGenerated: generatedBills };
  },

  // UPDATE PROFILE
  updateCompanyProfile(companyId: string, profile: Partial<CompanyProfile>): CompanyProfile {
    const db = this.getCompanyDatabase(companyId);
    db.profile = { ...db.profile, ...profile };
    this.saveCompanyDatabase(companyId, db);
    return db.profile;
  },

  // SUPPLIERS
  addSupplier(companyId: string, supplier: Omit<Supplier, 'id'>): Supplier {
    const db = this.getCompanyDatabase(companyId);
    const newSup: Supplier = {
      ...supplier,
      id: generateId('sup'),
    };
    db.suppliers.push(newSup);
    this.saveCompanyDatabase(companyId, db);
    return newSup;
  },
};
