import { CHAVE_PROGRESSO, validarRodada } from './motor.js';

export function lerProgresso(storage, historias) {
    const bruto = storage.getItem(CHAVE_PROGRESSO);
    if (!bruto) return { rodada: null, bruto, recuperado: false };
    try {
        const rodada = JSON.parse(bruto);
        if (validarRodada(rodada, historias)) return { rodada, bruto, recuperado: false };
    } catch { /* Dados inválidos serão substituídos somente ao iniciar uma rodada. */ }
    return { rodada: null, bruto, recuperado: true };
}

export function salvarProgresso(storage, rodada, brutoAnterior) {
    if (storage.getItem(CHAVE_PROGRESSO) !== brutoAnterior) {
        throw new Error('A jornada mudou em outra aba. Recarregue para continuar do ponto salvo.');
    }
    const bruto = JSON.stringify(rodada);
    storage.setItem(CHAVE_PROGRESSO, bruto);
    return bruto;
}
