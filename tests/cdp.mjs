// Executar com servidor local em 8765 e Chrome de teste com depuração em 9222.
// Use um perfil de navegador separado: estes testes alteram o apelido e a jornada.
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8765/';
const tabs = await (await fetch('http://127.0.0.1:9222/json')).json();
const ws = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve) => { ws.onopen = resolve; });
let sequencia = 0;
const pendentes = new Map(), erros = [];
ws.onmessage = (evento) => {
    const mensagem = JSON.parse(evento.data);
    if (mensagem.id) {
        pendentes.get(mensagem.id)?.(mensagem);
        pendentes.delete(mensagem.id);
    } else if (mensagem.method === 'Runtime.exceptionThrown') erros.push(mensagem.params.exceptionDetails.text);
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequencia;
    pendentes.set(id, (resposta) => resposta.error ? reject(resposta.error) : resolve(resposta.result));
    ws.send(JSON.stringify({ id, method, params }));
});
const avaliar = async (expression) => {
    const resposta = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (resposta.exceptionDetails) throw new Error(resposta.exceptionDetails.text);
    return resposta.result.value;
};
const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function esperar(expressao) {
    for (let i = 0; i < 100; i++) {
        try { if (await avaliar(expressao)) return; } catch { /* Documento em transição. */ }
        await pausa(100);
    }
    throw new Error(`Tempo esgotado: ${expressao}; URL: ${await avaliar('location.href')}`);
}
const ir = async (pagina) => { await call('Page.navigate', { url: new URL(pagina, base).href }); await pausa(150); };
const clicar = (seletor) => avaliar(`document.querySelector(${JSON.stringify(seletor)}).click()`);
const progresso = () => avaliar(`JSON.parse(localStorage.getItem('entreLinhas.jornada.v1'))`);
const telaPronta = (tipo) => esperar(`document.body.classList.contains('pagina-${tipo}') && !document.querySelector('[data-historia-conteudo]')?.hidden && !!document.querySelector('[data-acao]:not(:disabled)')`);
const inicioPronto = () => esperar(`!!document.querySelector('[data-acao="iniciar-jornada"]:not(:disabled)')`);

export { base, call, avaliar, pausa, esperar, ir, clicar, progresso, telaPronta, inicioPronto, ws, erros };
