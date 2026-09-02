export type UserRole = 'admin' | 'collaborator' | 'financeiro' | 'compras' | 'master';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type StoreStatus = 'ATIVA' | 'BLOQUEADA' | 'PENDENTE';

export type UserAccessStatus = 'ATIVO' | 'BLOQUEADO' | 'PENDENTE';

export interface MasterAuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  targetStoreId?: string;
  targetStoreName?: string;
  targetUserId?: string;
  details?: string;
  createdAt: string;
}

export interface UserAccount {
  uid?: string;
  email: string;
  name: string;
  password?: string;
  companyId: string;
  companyName?: string;
  phone?: string;
  role: UserRole;
  department?: string;
  status?: UserAccessStatus;
  approvalStatus?: ApprovalStatus;
  licenseDays?: number; // 30, 90, 180, 365
  approvedAt?: string;
  approvedBy?: string;
  expiresAt?: string; // YYYY-MM-DD
  lastAccessAt?: string;
  createdAt: string;
}

export interface AccessRequest {
  id: string;
  userId: string;
  email: string;
  name: string;
  companyName: string;
  phone: string;
  status: ApprovalStatus;
  licenseDays: 30 | 90 | 180 | 365;
  notes?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  expiresAt?: string;
}

export interface Collaborator {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  status?: UserAccessStatus;
  lastAccessAt?: string;
  createdAt: string;
  uid?: string;
}

export interface CompanyProfile {
  id: string;
  name: string;
  tradeName?: string;
  cnpj: string;
  phone: string;
  email?: string;
  managerName?: string;
  address: string;
  city?: string;
  state?: string;
  logo?: string;
  status?: StoreStatus;
  dailyLimit: number;
  monthlyLimit: number;
  protectedDay: number; // e.g. 20 for payroll / tax protected day
  createdAt: string;
  updatedAt?: string;
  lastAccessAt?: string;
  usersCount?: number;
  ownerUid?: string;
  collaboratorUids?: string[];
}

export interface Supplier {
  id: string;
  companyId?: string;
  name: string;
  cnpj?: string;
  phone?: string;
  category?: string;
  defaultTerms?: number[];
  createdAt?: string;
}

export type BillStatus = 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado';

export interface Bill {
  id: string;
  purchaseId?: string;
  companyId: string;
  supplierId?: string;
  supplierName: string;
  desc: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: BillStatus;
  paidAt?: string;
  paidAmount?: number;
  parcel?: string; // e.g. "1/3"
  category?: string;
  notes?: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  companyId: string;
  supplierId?: string;
  supplierName: string;
  totalAmount: number;
  date: string; // YYYY-MM-DD
  termsSelected: number[]; // e.g. [7, 14, 21]
  installmentsCount: number;
  notes?: string;
  createdAt: string;
}

export interface CompanyDatabase {
  profile: CompanyProfile;
  bills: Bill[];
  purchases: Purchase[];
  suppliers: Supplier[];
  collaborators: Collaborator[];
}

export interface AuthSession {
  uid?: string;
  email: string;
  name: string;
  companyId: string;
  role: UserRole;
  companyName: string;
  isSuperAdmin?: boolean;
  isMaster?: boolean;
  storeStatus?: StoreStatus;
  approvalStatus?: ApprovalStatus;
  licenseDays?: number;
  expiresAt?: string;
}

export type CalendarFilterMode = 'semanal' | 'quinzenal' | 'mensal';

export type NavigationRoute = 
  | 'dashboard'
  | 'simulador'
  | 'contas'
  | 'calendario'
  | 'compras-lista'
  | 'fornecedores'
  | 'config'
  | 'licencas-admin'
  | 'master-dashboard'
  | 'master-lojas'
  | 'master-usuarios'
  | 'master-atividades';

