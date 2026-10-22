/**
 * ============================================================================
 * DIGI-TRON TI — TABELAS DE MAPEAMENTO OFICIAL GLPI (Nome -> ID Numérico)
 * ============================================================================
 * 
 * Este arquivo centraliza o mapeamento de nomes, logins e e-mails para os
 * identificadores numéricos oficiais cadastrados na sua instalação local do GLPI.
 * 
 * Regra Obrigatória da API REST do GLPI:
 * - Todos os campos de relacionamentos exigem NÚMEROS inteiros positivos.
 * - Nunca enviar string vazia, null, undefined ou strings de e-mail nesses campos.
 */

// 1. REQUERENTES (users_id no GLPI)
export const GLPI_REQUESTERS_MAP: Record<string, number> = {
  // Nome Completo / Login / E-mail -> ID Numérico
  'joao.leopoldino': 2,
  'João Leopoldino': 2,
  'joao.leopoldino@digitronbalancas.com.br': 2,
  'glpi': 2,
  'suporte.ti': 3,
  'Suporte TI': 3,
  'suporte.ti@digitronbalancas.com.br': 3,
  'admin': 2,
  'tecnico': 3
};

// 2. TÉCNICOS / ATRIBUÍDOS (users_id no GLPI)
export const GLPI_TECHNICIANS_MAP: Record<string, number> = {
  // Nome Completo / Login / E-mail -> ID Numérico
  'joao.leopoldino': 2,
  'João Leopoldino': 2,
  'joao.leopoldino@digitronbalancas.com.br': 2,
  'glpi': 2,
  'suporte.ti': 3,
  'Suporte TI': 3,
  'suporte.ti@digitronbalancas.com.br': 3,
  'admin': 2
};

// 3. GRUPOS DE TI (groups_id no GLPI)
export const GLPI_GROUPS_MAP: Record<string, number> = {
  // Nome do Grupo -> ID Numérico
  'Equipe de TI': 1,
  'TI': 1,
  'Tecnologia da Informação': 1,
  'Infraestrutura': 1,
  'Infraestrutura e Redes': 2,
  'Sistemas e ERP': 3,
  'Suporte N1': 1,
  'Suporte N2': 1
};

// 4. CATEGORIAS ITIL (itilcategories_id no GLPI)
export const GLPI_CATEGORIES_MAP: Record<string, number> = {
  // Nome da Categoria Oficial de TI -> ID Numérico
  'TI - Infraestrutura e Servidores': 1,
  'Infraestrutura e Servidores': 1,
  'TI - Backups e Armazenamento': 2,
  'Backups e Armazenamento': 2,
  'TI - Redes e Conectividade': 3,
  'Redes e Conectividade': 3,
  'TI - Sistemas e ERP Factory OS': 4,
  'Sistemas e ERP Factory OS': 4,
  'ERP Factory OS': 4,
  'TI - Suporte a Usuários e Estações': 5,
  'Suporte a Usuários e Estações': 5,
  'TI - Segurança da Informação': 6,
  'Segurança da Informação': 6,
  'TI - Bancos de Dados': 7,
  'Bancos de Dados': 7,
  'TI - Periféricos e Impressão': 8,
  'Periféricos e Impressão': 8
};

// 5. LOCALIZAÇÕES (locations_id no GLPI)
export const GLPI_LOCATIONS_MAP: Record<string, number> = {
  'Matriz': 1,
  'CPD': 2,
  'Datacenter': 2,
  'Administrativo': 3,
  'Fábrica': 4,
  'Galpão 1': 5
};

// 6. ORIGENS DA REQUISIÇÃO (requesttypes_id no GLPI)
export const GLPI_REQUEST_TYPES_MAP: Record<string, number> = {
  'Helpdesk': 1,
  'E-mail': 2,
  'Telefone': 3,
  'Direto': 4,
  'Outro': 5,
  'Agendador Automático': 6
};

// 7. ENTIDADES (entities_id no GLPI)
export const GLPI_ENTITIES_MAP: Record<string, number> = {
  'Entidade Raiz': 0,
  'Root': 0,
  'Digi-Tron': 0,
  'Digi-Tron Matriz': 0
};

// ============================================================================
// FUNÇÕES AUXILIARES DE RESOLUÇÃO COM VALIDAÇÃO E LOGS
// ============================================================================

/**
 * Normaliza uma chave de busca para case-insensitive e sem acentos
 */
function normalizeKey(key: string): string {
  return String(key || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Converte valor (seja número ou nome/email) para o ID de Requerente numérico válido.
 */
export function resolveGlpiRequesterId(val: any, defaultId = 2): { id: number; warning?: string } {
  if (typeof val === 'number' && !isNaN(val) && val > 0) {
    return { id: val };
  }
  const str = String(val || '').trim();
  if (!str) {
    return { id: defaultId, warning: `Requerente não especificado. Usando ID padrão ${defaultId}.` };
  }
  // Se for string numérica
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum > 0 && String(parsedNum) === str) {
    return { id: parsedNum };
  }
  // Buscar no mapa
  const norm = normalizeKey(str);
  for (const [key, id] of Object.entries(GLPI_REQUESTERS_MAP)) {
    if (normalizeKey(key) === norm) {
      return { id };
    }
  }
  return {
    id: defaultId,
    warning: `Aviso: Requerente "${str}" não localizado no mapeamento do GLPI. Usando ID padrão de segurança ${defaultId}.`
  };
}

/**
 * Converte valor para o ID de Técnico/Atribuído numérico válido.
 */
export function resolveGlpiTechnicianId(val: any, defaultId?: number): { id?: number; warning?: string } {
  if (val === null || val === undefined || val === '' || val === 'none') {
    return { id: defaultId };
  }
  if (typeof val === 'number' && !isNaN(val) && val > 0) {
    return { id: val };
  }
  const str = String(val).trim();
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum > 0 && String(parsedNum) === str) {
    return { id: parsedNum };
  }
  const norm = normalizeKey(str);
  for (const [key, id] of Object.entries(GLPI_TECHNICIANS_MAP)) {
    if (normalizeKey(key) === norm) {
      return { id };
    }
  }
  if (defaultId) {
    return {
      id: defaultId,
      warning: `Aviso: Técnico "${str}" não localizado no mapeamento do GLPI. Usando ID padrão ${defaultId}.`
    };
  }
  return {
    warning: `Aviso: Técnico "${str}" não localizado no mapeamento do GLPI. O chamado será criado sem técnico individual atribuído.`
  };
}

/**
 * Converte valor para o ID de Grupo numérico válido.
 */
export function resolveGlpiGroupId(val: any, defaultId = 1): { id: number; warning?: string } {
  if (typeof val === 'number' && !isNaN(val) && val > 0) {
    return { id: val };
  }
  const str = String(val || '').trim();
  if (!str) {
    return { id: defaultId };
  }
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum > 0 && String(parsedNum) === str) {
    return { id: parsedNum };
  }
  const norm = normalizeKey(str);
  for (const [key, id] of Object.entries(GLPI_GROUPS_MAP)) {
    if (normalizeKey(key) === norm) {
      return { id };
    }
  }
  return {
    id: defaultId,
    warning: `Aviso: Grupo "${str}" não localizado no mapeamento do GLPI. Atribuindo ao grupo padrão de TI (ID ${defaultId}).`
  };
}

/**
 * Converte valor para o ID de Categoria numérico válido.
 */
export function resolveGlpiCategoryId(val: any, defaultId = 1): { id: number; warning?: string } {
  if (typeof val === 'number' && !isNaN(val) && val > 0) {
    return { id: val };
  }
  const str = String(val || '').trim();
  if (!str) {
    return { id: defaultId };
  }
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum > 0 && String(parsedNum) === str) {
    return { id: parsedNum };
  }
  const norm = normalizeKey(str);
  for (const [key, id] of Object.entries(GLPI_CATEGORIES_MAP)) {
    if (normalizeKey(key) === norm) {
      return { id };
    }
  }
  return {
    id: defaultId,
    warning: `Aviso: Categoria "${str}" não localizada no mapeamento. Usando categoria padrão de TI (ID ${defaultId}).`
  };
}

/**
 * Converte valor para o ID de Localização numérico válido.
 */
export function resolveGlpiLocationId(val: any): { id?: number; warning?: string } {
  if (val === null || val === undefined || val === '' || val === 0) {
    return {};
  }
  if (typeof val === 'number' && !isNaN(val) && val > 0) {
    return { id: val };
  }
  const str = String(val).trim();
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum > 0 && String(parsedNum) === str) {
    return { id: parsedNum };
  }
  const norm = normalizeKey(str);
  for (const [key, id] of Object.entries(GLPI_LOCATIONS_MAP)) {
    if (normalizeKey(key) === norm) {
      return { id };
    }
  }
  return {
    warning: `Aviso: Localização "${str}" não localizada no mapeamento do GLPI.`
  };
}

/**
 * Converte valor para o ID de Origem da Requisição numérico válido.
 */
export function resolveGlpiRequestTypeId(val: any, defaultId = 1): { id: number } {
  if (typeof val === 'number' && !isNaN(val) && val > 0) {
    return { id: val };
  }
  const str = String(val || '').trim();
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum > 0 && String(parsedNum) === str) {
    return { id: parsedNum };
  }
  const norm = normalizeKey(str);
  for (const [key, id] of Object.entries(GLPI_REQUEST_TYPES_MAP)) {
    if (normalizeKey(key) === norm) {
      return { id };
    }
  }
  return { id: defaultId };
}

/**
 * Converte valor para o ID de Entidade numérico válido.
 */
export function resolveGlpiEntityId(val: any, defaultId = 0): { id: number } {
  if (val === 0 || val === '0') return { id: 0 };
  if (typeof val === 'number' && !isNaN(val) && val >= 0) {
    return { id: val };
  }
  const str = String(val || '').trim();
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum >= 0 && String(parsedNum) === str) {
    return { id: parsedNum };
  }
  const norm = normalizeKey(str);
  for (const [key, id] of Object.entries(GLPI_ENTITIES_MAP)) {
    if (normalizeKey(key) === norm) {
      return { id };
    }
  }
  return { id: defaultId };
}
