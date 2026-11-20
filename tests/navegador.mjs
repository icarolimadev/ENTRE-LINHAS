// Executar com servidor local em 8765 e Chrome de teste com depuração em 9222.
// Use um perfil de navegador separado: este teste limpa somente a chave de progresso.
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
let casos = 0;
function ok(nome) { casos++; console.log(`OK ${casos}: ${nome}`); }

try {
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
    await call('Network.setCacheDisabled', { cacheDisabled: true });
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await ir('src/pages/inicio.html'); await inicioPronto();
    await avaliar(`localStorage.removeItem('entreLinhas.jornada.v1');localStorage.setItem('entreLinhas.apelido','Teste');`);
    await ir('src/pages/inicio.html'); await inicioPronto();
    await clicar('[data-acao="iniciar-jornada"]'); await telaPronta('historia');
    const primeira = await progresso();
    assert.equal(new Set(primeira.ordem).size, 5);
    assert.equal(primeira.indice, 0);
    ok('início sorteia cinco histórias únicas');

    await avaliar(`{const botao=document.querySelector('[data-opcao-id="a"]');botao.click();botao.click();}`);
    await telaPronta('reflexao');
    assert.equal((await progresso()).respostas.length, 1);
    ok('duplo clique registra uma única resposta');
    await clicar('[data-acao="rever-historia"]'); await telaPronta('historia');
    assert.equal(await avaliar(`document.querySelector('[aria-pressed="true"]').dataset.opcaoId`), 'a');
    await clicar('[data-opcao-id="b"]'); await telaPronta('reflexao');
    assert.equal((await progresso()).respostas[0].opcaoId, 'b');
    assert.equal((await progresso()).respostas.length, 1);
    ok('rever troca a escolha sem duplicar etapa');

    const salvo = await progresso();
    await call('Page.reload'); await pausa(150); await telaPronta('reflexao');
    assert.deepEqual(await progresso(), salvo);
    await ir('src/pages/inicio.html'); await inicioPronto();
    assert.match(await avaliar(`document.querySelector('[data-acao="iniciar-jornada"]').textContent`), /Continuar/);
    await clicar('[data-acao="iniciar-jornada"]'); await telaPronta('reflexao');
    assert.deepEqual(await progresso(), salvo);
    ok('recarregar e voltar pelo início retomam a reflexão salva');

    for (let i = 1; i < 5; i++) {
        await clicar('[data-acao="proxima-historia"]'); await telaPronta('historia');
        assert.equal((await progresso()).indice, i);
        assert.equal(await avaliar(`document.querySelector('.historia__etapa').textContent`), `História ${i + 1} de 5`);
        await clicar('[data-opcao-id="c"]'); await telaPronta('reflexao');
    }
    await clicar('[data-acao="proxima-historia"]'); await telaPronta('conclusao');
    const concluida = await progresso();
    assert.equal(concluida.fase, 'concluida');
    assert.equal(concluida.respostas.length, 5);
    ok('jornada chega à conclusão somente após cinco respostas e reflexões');

    await clicar('[data-acao="jogar-novamente"]'); await telaPronta('historia');
    const nova = await progresso();
    assert.notDeepEqual(nova.ordem, concluida.ordem);
    assert.notEqual(nova.ordem[0], concluida.ordem.at(-1));
    assert.equal(nova.respostas.length, 0);
    assert.equal(await avaliar(`localStorage.getItem('entreLinhas.apelido')`), 'Teste');
    ok('nova rodada limpa respostas, muda ordem e preserva apelido');
    await ir('src/pages/conclusao.html'); await telaPronta('historia');
    assert.deepEqual(await progresso(), nova);
    await ir('src/pages/reflexao1.html?rodada=1'); await telaPronta('historia');
    ok('acesso direto não pula escolha nem antecipa conclusão');

    await ir('src/pages/historia1.html?historia=historia-4');
    await esperar(`document.querySelector('#titulo-historia')?.textContent==='Acesso à prática'`);
    assert.deepEqual(await progresso(), nova);
    assert.equal(await avaliar(`document.querySelectorAll('.historia__opcoes button:not(:disabled)').length`), 0);
    ok('prévia editorial não modifica progresso');

    await avaliar(`localStorage.setItem('entreLinhas.jornada.v1','{invalido')`);
    await ir('src/pages/inicio.html'); await inicioPronto();
    await clicar('[data-acao="iniciar-jornada"]'); await telaPronta('historia');
    assert.equal((await progresso()).respostas.length, 0);
    ok('JSON de progresso corrompido permite iniciar uma nova rodada');

    const anterior = await progresso();
    const bloqueio = await call('Page.addScriptToEvaluateOnNewDocument', { source: `const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='entreLinhas.jornada.v1')throw new DOMException('Quota excedida','QuotaExceededError');return set.call(this,k,v)}` });
    await call('Page.reload'); await pausa(150); await telaPronta('historia');
    await clicar('[data-opcao-id="a"]');
    await esperar(`document.querySelector('[data-jogo-aviso]')?.getAttribute('role')==='alert'`);
    assert.deepEqual(await progresso(), anterior);
    assert.ok((await avaliar(`location.pathname`)).endsWith('historia1.html'));
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: bloqueio.identifier });
    ok('falha de escrita exibe aviso e preserva progresso sem navegar');

    const fixture = await call('Page.addScriptToEvaluateOnNewDocument', { source: `const original=window.fetch;window.fetch=async(...args)=>{const response=await original(...args);if(String(args[0]).includes('historias.json')){const data=await response.json();for(const h of data.historias){h.opcoes[0].consequencia='Consequência A <img src=x onerror=alert(1)>';h.opcoes[1].consequencia='Consequência B de teste';}return new Response(JSON.stringify(data),{status:200});}return response;}` });
    await ir('src/pages/inicio.html'); await inicioPronto();
    await clicar('[data-acao="iniciar-jornada"]'); await telaPronta('historia');
    await clicar('[data-opcao-id="a"]'); await telaPronta('reflexao');
    assert.match(await avaliar(`document.querySelector('[aria-labelledby="titulo-impacto"] .reflexao__descricao').textContent`), /Consequência A <img/);
    assert.equal(await avaliar(`document.querySelector('[aria-labelledby="titulo-impacto"] .reflexao__descricao img')===null`), true);
    await clicar('[data-acao="rever-historia"]'); await telaPronta('historia');
    await clicar('[data-opcao-id="b"]'); await telaPronta('reflexao');
    assert.equal(await avaliar(`document.querySelector('[aria-labelledby="titulo-impacto"] .reflexao__descricao').textContent`), 'Consequência B de teste');
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixture.identifier });
    ok('consequências específicas aparecem por escolha e HTML é exibido como texto');

    await ir('src/pages/inicio.html'); await inicioPronto();
    await clicar('[data-acao="iniciar-jornada"]'); await telaPronta('historia');
    assert.equal((await progresso()).respostas.length, 0);
    ok('mudança editorial invalida rodada antiga sem misturar respostas');
    await clicar('[data-opcao-id="a"]'); await telaPronta('reflexao');
    await clicar('[data-acao="proxima-historia"]'); await telaPronta('historia');
    const aposAvanco = await progresso();
    await avaliar('history.back()'); await pausa(300); await telaPronta('historia');
    assert.deepEqual(await progresso(), aposAvanco);
    assert.equal(await avaliar(`document.body.dataset.historiaId`), aposAvanco.ordem[aposAvanco.indice]);
    ok('voltar no navegador mantém a etapa atual sem duplicar resposta');

    await avaliar(`window.dispatchEvent(new StorageEvent('storage',{key:'entreLinhas.jornada.v1'}))`);
    await esperar(`document.querySelector('[data-jogo-aviso]')?.getAttribute('role')==='alert'`);
    assert.equal(await avaliar(`document.querySelectorAll('.historia__opcoes button:not(:disabled)').length`), 0);
    ok('mudança em outra aba bloqueia ações antigas e pede recarregamento');

    const leituraBloqueada = await call('Page.addScriptToEvaluateOnNewDocument', { source: `const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k==='entreLinhas.jornada.v1')throw new DOMException('Bloqueado','SecurityError');return get.call(this,k)}` });
    await ir('src/pages/inicio.html');
    await esperar(`document.querySelector('[data-jogo-aviso]')?.textContent.includes('armazenamento')`);
    assert.equal(await avaliar(`document.querySelector('[data-acao="iniciar-jornada"]').disabled`), true);
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: leituraBloqueada.identifier });
    ok('armazenamento bloqueado informa o problema antes de iniciar');
    assert.deepEqual(erros, []);
    console.log(`${casos} cenários de navegador passaram, sem exceções não tratadas.`);
} finally { ws.close(); }
