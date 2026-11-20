// Mesmo servidor e perfil isolado de tests/navegador.mjs.
// Confere os 30 enunciados e os 90 retornos reais, incluindo overflow em telas pequenas.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8765/';
const { historias } = JSON.parse(fs.readFileSync(new URL('../src/data/historias.json', import.meta.url), 'utf8'));
const tabs = await (await fetch('http://127.0.0.1:9222/json')).json();
const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve) => { ws.onopen = resolve; });
let id = 0;
const pendentes = new Map(), erros = [], falhas = [];
ws.onmessage = (evento) => {
    const resposta = JSON.parse(evento.data);
    if (resposta.id) { pendentes.get(resposta.id)?.(resposta); pendentes.delete(resposta.id); }
    else if (resposta.method === 'Runtime.exceptionThrown') erros.push(resposta.params.exceptionDetails.text);
};
const call = (method, params = {}) => new Promise((resolve, reject) => {
    const chave = ++id;
    pendentes.set(chave, (r) => r.error ? reject(r.error) : resolve(r.result));
    ws.send(JSON.stringify({ id: chave, method, params }));
});
const avaliar = async (expression) => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
};
const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function pronta(idHistoria, tipo) {
    for (let i = 0; i < 100; i++) {
        try {
            if (await avaliar(`document.readyState==='complete' && document.body.dataset.historiaId===${JSON.stringify(idHistoria)} && document.body.dataset.telaHistoria===${JSON.stringify(tipo)} && !document.querySelector('[data-historia-conteudo]').hidden && !document.querySelector('[data-acao]').disabled`)) {
                await avaliar('document.fonts.ready.then(()=>true)');
                return;
            }
        } catch { /* Navegação ainda em andamento. */ }
        await pausa(50);
    }
    throw new Error(`Tela não carregou: ${tipo} / ${idHistoria}`);
}
let casos = 0;
try {
    await call('Runtime.enable'); await call('Page.enable');
    await call('Network.enable'); await call('Network.setCacheDisabled', { cacheDisabled: true });
    await call('Page.navigate', { url: new URL('src/pages/inicio.html', base).href });
    await pausa(500);
    for (const [width, height] of [[320, 568], [390, 844]]) {
        await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
        for (const historia of historias) {
            for (const opcaoId of [null, 'a', 'b', 'c']) {
                const tipo = opcaoId ? 'reflexao' : 'historia';
                await avaliar(`(async()=>{
                    const m=await import('/src/js/jogo/motor.js');
                    const {historias}=await(await fetch('/src/data/historias.json')).json();
                    let r=m.criarRodada(historias);
                    const id=${JSON.stringify(historia.id)};
                    r.ordem=[id,...historias.filter(h=>h.id!==id).slice(0,4).map(h=>h.id)];
                    if(${JSON.stringify(opcaoId)})r=m.responder(r,historias,id,${JSON.stringify(opcaoId)});
                    localStorage.setItem(m.CHAVE_PROGRESSO,JSON.stringify(r));
                })()`);
                await call('Page.navigate', { url: new URL(`src/pages/${tipo}1.html?rodada=1&historia=${historia.id}`, base).href });
                await pausa(60);
                await pronta(historia.id, tipo);
                const resultado = await avaliar(`(()=>{
                    const m=document.querySelector('main');
                    return {largura:innerWidth,documento:document.body.scrollWidth,altura:m.clientHeight,conteudo:m.scrollHeight,
                        titulo:document.querySelector('#titulo-historia')?.textContent,
                        situacao:document.querySelector('.historia__descricao')?.textContent,
                        retorno:document.querySelector('[aria-labelledby="titulo-impacto"] .reflexao__descricao')?.textContent,
                        pergunta:document.querySelector('[aria-labelledby="titulo-refletir"] .reflexao__descricao')?.textContent,
                        alternativas:[...document.querySelectorAll('.historia__opcoes button')].map(b=>b.textContent),
                        marcadores:document.querySelectorAll('.historia__marcador').length,
                        fontes:document.fonts.check('700 18px Poppins')&&document.fonts.check('400 15px Inter'),
                        imagens:[...document.images].every(i=>i.complete&&i.naturalWidth>0)};
                })()`);
                if (opcaoId) {
                    assert.equal(resultado.retorno, historia.opcoes.find((o) => o.id === opcaoId).consequencia);
                    assert.equal(resultado.pergunta, historia.reflexao.pergunta);
                } else {
                    assert.equal(resultado.titulo, historia.titulo);
                    assert.equal(resultado.situacao, historia.situacao);
                    assert.equal(resultado.marcadores, 5);
                    assert.deepEqual(resultado.alternativas, historia.opcoes.map((o) => `${o.id.toUpperCase()}) ${o.texto}`));
                }
                if (resultado.documento > width || resultado.conteudo > resultado.altura + 1 || !resultado.fontes || !resultado.imagens) {
                    falhas.push({ historia: historia.id, opcaoId, width, height, ...resultado });
                }
                if (historia.id === 'historia-25' && width === 390 && (!opcaoId || opcaoId === 'b')) {
                    const shot = await call('Page.captureScreenshot', { format: 'png' });
                    fs.writeFileSync(`/tmp/biblioteca-${tipo}.png`, Buffer.from(shot.data, 'base64'));
                }
                casos++;
            }
        }
        console.log(`Conferidas 30 situações e 90 consequências em ${width} × ${height}.`);
    }
    fs.writeFileSync('/tmp/biblioteca-resultados.json', JSON.stringify({ casos, falhas, erros }, null, 2));
    console.log(JSON.stringify({ casos, falhas: falhas.map(({historia,opcaoId,width,altura,conteudo})=>({historia,opcaoId,width,altura,conteudo})), erros }, null, 2));
    assert.equal(falhas.length, 0, 'Há telas que precisam de ajuste de layout; consulte /tmp/biblioteca-resultados.json.');
    assert.equal(erros.length, 0);
} finally { ws.close(); }
