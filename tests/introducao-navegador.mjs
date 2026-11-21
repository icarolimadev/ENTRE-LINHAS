// Servidor de QA com CSP em 8765 + Chrome isolado em 9222. Sem dependências.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { call, avaliar, pausa, esperar, ir, ws, erros } from './cdp.mjs';
const diretorio = 'docs/evidencias-introducao';
mkdirSync(diretorio, { recursive: true });
const resultados = [], requisicoes = [], consoleErros = [];
ws.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (m.method === 'Network.requestWillBeSent') requisicoes.push(m.params.request.url);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') consoleErros.push(m.params.entry.text);
});
const ok = (nome) => { resultados.push(nome); console.log(`OK ${resultados.length}: ${nome}`); };
const pronta = () => esperar(`document.querySelector('.intro--animando') && document.getAnimations().length >= 43`);
const destino = () => esperar(`location.pathname.endsWith('boas-vindas.html')`);
async function abrir() {
    await ir('index.html');
    await esperar(`document.readyState === 'complete' && !!document.querySelector('.abertura__botao')`);
    const ponto = await avaliar(`(()=>{const r=document.querySelector('.abertura__botao').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...ponto, button: 'left', clickCount: 1 });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...ponto, button: 'left', clickCount: 1 });
}
async function capturar(nome, tempo = 5000) {
    await avaliar(`document.getAnimations().forEach(a=>{a.pause();a.currentTime=${tempo}})`);
    await pausa(30);
    const { data } = await call('Page.captureScreenshot');
    writeFileSync(`${diretorio}/${nome}.png`, Buffer.from(data, 'base64'));
}
try {
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable'); await call('Log.enable');
    await call('Network.setCacheDisabled', { cacheDisabled: true });
    await call('Emulation.setEmulatedMedia', { features: [] });
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await ir('index.html');
    await esperar(`document.readyState === 'complete'`);
    await pausa(11500);
    assert.equal(await avaliar(`document.querySelector('.intro').hidden`), true);
    assert.equal(await avaliar(`getComputedStyle(document.body).backgroundColor`), 'rgb(28, 11, 45)');
    assert.equal(await avaliar('document.getAnimations().length'), 0);
    const abertura = await call('Page.captureScreenshot');
    writeFileSync(`${diretorio}/abertura-oficial.png`, Buffer.from(abertura.data, 'base64'));
    ok('abertura aguarda Entrar sem animação, áudio ou avanço automático');
    const rastrearAudio = await call('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const Original=window.Audio;window.Audio=function(...args){return window.__audioEntrada=new Original(...args)}})()` });
    await abrir(); await pronta();
    await esperar(`window.__audioEntrada && !window.__audioEntrada.paused && window.__audioEntrada.currentTime > .1`);
    await avaliar(`document.querySelector('.intro__continuar').click()`); await destino();
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: rastrearAudio.identifier });
    ok('clique real inicia áudio e animação no mesmo documento');
    for (const [width, height] of [[320,568],[360,800],[390,844],[412,915],[768,1024],[1366,768],[1920,1080],[844,390],[2560,1080]]) {
        await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 800 });
        await abrir(); await pronta();
        await capturar(`${width}x${height}`);
        const medida = await avaliar(`(()=>{const svg=document.querySelector('svg').getBoundingClientRect();const body=document.body;return {overflow:document.documentElement.scrollWidth>innerWidth || document.documentElement.scrollHeight>innerHeight,centerX:svg.x+svg.width/2,centerY:svg.y+svg.height/2,ratio:svg.width/svg.height,bg:getComputedStyle(body).backgroundColor,media:document.querySelectorAll('video,iframe,canvas').length,visible:[...document.querySelectorAll('[data-peca],[data-letra]')].every(e=>getComputedStyle(e).opacity==='1')}})()`);
        assert.equal(medida.overflow, false); assert.equal(medida.media, 0); assert.equal(medida.visible, true);
        assert.equal(medida.bg, 'rgb(0, 0, 0)'); assert.ok(Math.abs(medida.ratio - 1) < .001);
        assert.ok(Math.abs(medida.centerX - width/2) < 1 && Math.abs(medida.centerY - height/2) < 1);
        ok(`marca completa, centralizada e sem rolagem em ${width} × ${height}`);
    }
    await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await abrir(); await pronta();
    for (const t of [500,1000,2000,3000,4000,5000]) await capturar(`sequencia-${t}`,t);
    await avaliar(`document.dispatchEvent(new Event('intro:encerrar'))`);
    assert.equal(await avaliar(`getComputedStyle(document.querySelector('.intro__marca')).visibility`), 'hidden');
    ok('capturas temporais e saída sem reaparecimento da marca');
    assert.ok(!requisicoes.some(url=>url.endsWith('.mp4')));
    assert.ok(requisicoes.every(url=>url.startsWith('http://127.0.0.1:8765/') || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)));
    assert.deepEqual(consoleErros, []); assert.deepEqual(erros, []);
    ok('entrada sem MP4 ou erros de CSP/console; apenas fontes externas já utilizadas');

    await abrir(); await pronta();
    const inicio=Date.now(); await destino();
    assert.ok(Date.now()-inicio > 7000 && Date.now()-inicio < 10000);
    ok('sequência completa avança automaticamente em aproximadamente 8 segundos');

    await abrir(); await pronta();

    assert.equal(await avaliar('document.activeElement.className'), 'intro__continuar');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await destino(); ok('pular com Tab e Enter');

    await abrir(); await pronta();
    await avaliar(`sessionStorage.setItem('intro-encerramentos','0');document.addEventListener('intro:encerrar',()=>sessionStorage.setItem('intro-encerramentos',String(Number(sessionStorage.getItem('intro-encerramentos'))+1)));document.dispatchEvent(new Event('intro:avancar'));document.dispatchEvent(new Event('intro:avancar'));document.querySelector('.intro__continuar').click()`);
    await destino();
    assert.equal(await avaliar(`sessionStorage.getItem('intro-encerramentos')`), '1');
    ok('eventos e cliques simultâneos encerram a introdução uma única vez');

    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await abrir();
    assert.equal(await avaliar('document.getAnimations().length'), 0);
    assert.equal(await avaliar(`getComputedStyle(document.querySelector('[data-peca]')).opacity`), '1');
    await destino(); ok('movimento reduzido: marca estática e avanço');
    await call('Emulation.setEmulatedMedia', { features: [] });
    await abrir(); await pronta();
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await pausa(60); assert.equal(await avaliar('document.getAnimations().length'), 0);
    await destino(); ok('mudança de preferência durante a sequência');
    await call('Emulation.setEmulatedMedia', { features: [] });

    const bloqueio = await call('Page.addScriptToEvaluateOnNewDocument', { source: `HTMLMediaElement.prototype.play=function(){return Promise.reject(new DOMException('Blocked','NotAllowedError'))}` });
    await abrir(); await pronta(); await destino();
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: bloqueio.identifier });
    ok('autoplay de áudio bloqueado não impede a conclusão');

    const semAudio = await call('Page.addScriptToEvaluateOnNewDocument', { source: `window.Audio=function(){throw new Error('Áudio indisponível')}` });
    await abrir(); await pronta(); await destino();
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: semAudio.identifier });
    ok('API de áudio indisponível preserva a sequência completa');

    const falha = await call('Page.addScriptToEvaluateOnNewDocument', { source: `Element.prototype.animate=function(){throw new Error('Falha simulada')}` });
    await abrir(); await destino();
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: falha.identifier });
    ok('falha na API de animação mostra alternativa estática e avança');

    await call('Network.setBlockedURLs', { urls: ['*introducao.js'] });
    await abrir();
    await pausa(10500); await destino();
    await call('Network.setBlockedURLs', { urls: [] });
    ok('módulo bloqueado: proteção independente avança em 11 segundos');

    await call('Emulation.setScriptExecutionDisabled', { value: true });
    await ir('index.html');
    // CDP Runtime.evaluate funciona mesmo com os scripts da página desabilitados.
    assert.equal(await avaliar(`getComputedStyle(document.querySelector('[data-peca]')).opacity`), '1');
    await avaliar(`document.querySelector('.abertura__botao').click()`); await destino();
    await call('Emulation.setScriptExecutionDisabled', { value: false });
    ok('sem JavaScript: marca estática e link nativo funcional');
    assert.deepEqual(erros, []);
    writeFileSync(`${diretorio}/resultados.json`, JSON.stringify({ resultados, erros, observacao: 'Falhas de rede após os casos normais foram provocadas pelos testes.' }, null, 2));
} finally {
    await call('Emulation.setScriptExecutionDisabled', { value: false });
    await call('Network.setBlockedURLs', { urls: [] });
    ws.close();
}
