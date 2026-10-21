import {
  parseDateSafe,
  formatDateTime,
  formatDateOnly,
  formatTimeOnly,
  getSaoPauloParts,
  getSaoPauloTodayIso,
  createSaoPauloDate,
  calculateNextRunInSaoPaulo,
  SAO_PAULO_TZ
} from './dateTime';

console.log('====================================================');
console.log('EXECUÇÃO DOS TESTES OBRIGATÓRIOS DE DATA E HORA');
console.log('Fuso Horário Operacional: America/Sao_Paulo (Curitiba/SP)');
console.log('====================================================\n');

let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASSOU] ${testName}`);
  } else {
    console.error(`❌ [FALHOU] ${testName} - ${detail || ''}`);
    failedTests++;
  }
}

// 1. Data atual exibida corretamente em Curitiba, Paraná
const nowParts = getSaoPauloParts();
assert(
  nowParts.year >= 2026 && nowParts.month >= 1 && nowParts.month <= 12 && nowParts.day >= 1 && nowParts.day <= 31,
  '1. Extração correta da data atual em Curitiba/São Paulo',
  JSON.stringify(nowParts)
);

// 2. Data sem horário permanece no mesmo dia (sem subtrair ou adiantar 1 dia)
const testDateOnly = '2026-10-21';
const formattedDateOnly = formatDateOnly(testDateOnly);
assert(
  formattedDateOnly === '21/10/2026',
  '2. Data sem horário ("2026-10-21") permanece estritamente "21/10/2026"',
  `Recebido: "${formattedDateOnly}"`
);

// Another edge case date: First day of month
const firstOfMonth = '2026-11-01';
const formattedFirst = formatDateOnly(firstOfMonth);
assert(
  formattedFirst === '01/11/2026',
  '2b. Data sem horário ("2026-11-01") permanece no dia 1 e não retrocede para 31/10',
  `Recebido: "${formattedFirst}"`
);

// 3. Timestamp UTC é convertido corretamente para o horário de São Paulo
// UTC 11:30 is 08:30 in São Paulo (UTC-3)
const utcTimestamp = '2026-10-21T11:30:00.000Z';
const formattedFromUtc = formatDateTime(utcTimestamp);
assert(
  formattedFromUtc === '21/10/2026 às 08:30',
  '3. Timestamp UTC "2026-10-21T11:30:00Z" convertido para "21/10/2026 às 08:30" em SP',
  `Recebido: "${formattedFromUtc}"`
);

// 4. Horário de abertura e atualização de chamados GLPI (formato "YYYY-MM-DD HH:mm:ss")
const glpiTimestamp = '2026-10-21 14:45:00';
const parsedGlpi = parseDateSafe(glpiTimestamp);
assert(
  parsedGlpi !== null && !isNaN(parsedGlpi.getTime()),
  '4a. Parse seguro do formato SQL/GLPI "2026-10-21 14:45:00" sem Invalid Date'
);
const formattedGlpi = formatDateTime(glpiTimestamp);
assert(
  formattedGlpi === '21/10/2026 às 14:45',
  '4b. Formatação do timestamp do GLPI preserva dia 21 e horário 14:45',
  `Recebido: "${formattedGlpi}"`
);

// 5. Agendamento diário e semanal é executado no horário configurado em São Paulo
// Suppose current time in SP is 06:00 on 2026-10-21, routine is 07:00
const baseMorning = createSaoPauloDate(2026, 10, 21, 6, 0, 0);
const nextDaily = calculateNextRunInSaoPaulo({ frequency: 'daily', time: '07:00' }, baseMorning);
const nextDailyParts = getSaoPauloParts(nextDaily);
assert(
  nextDailyParts.day === 21 && nextDailyParts.hour === 7 && nextDailyParts.minute === 0,
  '5a. Agendamento diário para 07:00 calculado no mesmo dia se disparado antes das 07:00',
  `Calculado: ${JSON.stringify(nextDailyParts)}`
);

// If current time is 08:00 on 2026-10-21, routine at 07:00 must schedule for next day (22)
const baseAfter = createSaoPauloDate(2026, 10, 21, 8, 0, 0);
const nextDayDaily = calculateNextRunInSaoPaulo({ frequency: 'daily', time: '07:00' }, baseAfter);
const nextDayParts = getSaoPauloParts(nextDayDaily);
assert(
  nextDayParts.day === 22 && nextDayParts.hour === 7 && nextDayParts.minute === 0,
  '5b. Agendamento diário para 07:00 calculado para o dia seguinte (22/10) às 07:00',
  `Calculado: ${JSON.stringify(nextDayParts)}`
);

// 6. Mudanças de data à meia-noite não geram divergências
const justBeforeMidnight = createSaoPauloDate(2026, 10, 21, 23, 59, 50);
const justAfterMidnight = createSaoPauloDate(2026, 10, 22, 0, 0, 10);
const beforeParts = getSaoPauloParts(justBeforeMidnight);
const afterParts = getSaoPauloParts(justAfterMidnight);
assert(
  beforeParts.day === 21 && afterParts.day === 22,
  '6a. Transição da meia-noite incrementa dia corretamente (21 -> 22)',
  `Antes: dia ${beforeParts.day}, Depois: dia ${afterParts.day}`
);
assert(
  formatDateOnly(justBeforeMidnight) === '21/10/2026' && formatDateOnly(justAfterMidnight) === '22/10/2026',
  '6b. Formatação antes e depois da meia-noite é exata (21/10 e 22/10)'
);

console.log('\n----------------------------------------------------');
if (failedTests === 0) {
  console.log('🎯 TODOS OS 6 TESTES OBRIGATÓRIOS FORAM APROVADOS COM SUCESSO!');
} else {
  console.error(`💥 Houve ${failedTests} falha(s) nos testes.`);
  process.exit(1);
}
console.log('----------------------------------------------------');
