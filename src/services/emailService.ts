import { SUPER_ADMIN_EMAIL } from './firebase';

export interface RegistrationNotificationData {
  userId: string;
  email: string;
  name: string;
  companyName: string;
  phone: string;
  licenseDays?: number;
  createdAt?: string;
}

export const EmailNotificationService = {
  /**
   * Dispatches email notification to rogerionegocios682@gmail.com
   * when a new company/user registers.
   */
  async notifyNewCompanyRegistration(data: RegistrationNotificationData): Promise<boolean> {
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

    const subject = `🚀 Novo Registro de Empresa: ${data.companyName} (${data.name})`;
    const message = `
NOVO REGISTRO DE EMPRESA DETECTADO NO FLUXO ERP

Detalhes do Usuário e Empresa:
------------------------------------------
• Nome do Responsável: ${data.name}
• E-mail de Cadastro: ${data.email}
• Nome da Empresa: ${data.companyName}
• Telefone/WhatsApp: ${data.phone || 'Não informado'}
• ID do Usuário (Firestore): ${data.userId}
• Licença Inicial Solicitada: ${data.licenseDays || 30} dias
• Data/Hora do Registro: ${timestamp}

Ação Necessária:
------------------------------------------
Acesse o Painel do Administrador no Fluxo ERP (${currentUrl}) para aprovar a licença com validade de 30, 90, 180 ou 365 dias.

Notificação automática gerada pelo sistema Fluxo ERP.
    `.trim();

    try {
      // 1. Dispatch via FormSubmit AJAX endpoint to rogerionegocios682@gmail.com
      const res = await fetch(`https://formsubmit.co/ajax/${SUPER_ADMIN_EMAIL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          _subject: subject,
          _template: 'table',
          _captcha: 'false',
          'Empresa': data.companyName,
          'Responsavel': data.name,
          'Email': data.email,
          'Telefone_WhatsApp': data.phone || 'N/A',
          'User_UID_Firestore': data.userId,
          'Dias_Licenca_Sugeridos': `${data.licenseDays || 30} dias`,
          'Data_Registro': timestamp,
          'Status': 'Aguardando Aprovação de Licença',
          'Painel_Admin_URL': currentUrl,
          'Observacao': 'Defina o tempo de validade da licença no painel do administrador ou diretamente no Firestore.',
        }),
      });

      if (res.ok) {
        console.log(`Email notification successfully sent to ${SUPER_ADMIN_EMAIL}`);
        return true;
      } else {
        console.warn('Email dispatch returned non-200, logging notification locally');
        return false;
      }
    } catch (err) {
      console.error('Failed to dispatch registration email:', err);
      return false;
    }
  },

  /**
   * Helper to build a direct mailto link for administrative manual dispatch or test
   */
  getAdminMailtoUrl(data: RegistrationNotificationData): string {
    const subject = encodeURIComponent(`[Fluxo ERP] Novo Cadastro: ${data.companyName}`);
    const body = encodeURIComponent(
      `Novo usuário registrado:\n\nNome: ${data.name}\nEmail: ${data.email}\nEmpresa: ${data.companyName}\nTelefone: ${data.phone}\nUID: ${data.userId}\n\nFavor aprovar a licença no Painel Geral.`
    );
    return `mailto:${SUPER_ADMIN_EMAIL}?subject=${subject}&body=${body}`;
  },

  /**
   * Helper to build a direct WhatsApp link to contact the user
   */
  getUserWhatsAppUrl(phone: string, userName: string, companyName: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(
      `Olá ${userName}, recebemos o cadastro da empresa *${companyName}* no Fluxo ERP! Sua solicitação de licença está sendo processada por nosso time.`
    );
    return `https://wa.me/${fullNumber}?text=${text}`;
  },
};
