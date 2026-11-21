// Use perfil descartável. Execute com TEST_BASE_URL=http://127.0.0.1:8766/.
// Testa DOM XSS SEM a proteção de CSP e, depois, a aplicação COM CSP.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { base, call, avaliar, esperar, ir, clicar, inicioPronto, telaPronta, pausa, ws, erros } from './cdp.mjs';
const resultados=[];
const ok=nome=>{resultados.push(nome);console.log(`OK ${resultados.length}: ${nome}`)};
const payloads=['"><img src=x onerror=alert(1)>','javascript:alert(1)','<svg onload=alert(1)>'];
let guarda;
try {
    await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
    await call('Network.setCacheDisabled',{cacheDisabled:true});
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await call('Page.setBypassCSP',{enabled:true});
    guarda=await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__alertas=[];window.alert=(...args)=>window.__alertas.push(args);window.__violacoes=[];document.addEventListener('securitypolicyviolation',e=>window.__violacoes.push({diretiva:e.effectiveDirective,bloqueado:e.blockedURI}));`});
    async function seguro() {
        await pausa(100);
        assert.equal(await avaliar('window.__alertas.length'),0);
        assert.equal(await avaliar(`document.querySelectorAll('[onerror],[onload],a[href^="javascript:"]').length`),0);
        assert.equal(await avaliar('location.origin'),new URL(base).origin);
    }
    for(const payload of payloads) {
        await ir('src/pages/identificação.html');await esperar(`document.readyState==='complete'`);
        await avaliar(`document.querySelector('#nome').value=${JSON.stringify(payload)};document.querySelector('form').requestSubmit()`);
        await inicioPronto();await seguro();
        assert.equal(await avaliar(`document.querySelector('#titulo-inicio').textContent`),`Olá, ${payload}!`);
        ok(`apelido de formulário como texto: payload ${payloads.indexOf(payload)+1}`);
        await avaliar(`localStorage.setItem('entreLinhas.apelido',${JSON.stringify(payload)});localStorage.setItem('entreLinhas.jornada.v1',${JSON.stringify(payload)})`);
        await ir('src/pages/inicio.html');await inicioPronto();await seguro();
        await clicar('[data-acao="iniciar-jornada"]');await telaPronta('historia');await seguro();
        ok(`localStorage malicioso recuperado: payload ${payloads.indexOf(payload)+1}`);
        for(const parametro of ['historia','opcao','previa','rodada']) {
            const q=new URLSearchParams({previa:'1',historia:'historia-1',opcao:'a'});q.set(parametro,payload);
            await ir(`src/pages/reflexao1.html?${q}#${encodeURIComponent(payload)}`);
            await esperar(`document.readyState==='complete' && (document.querySelector('[data-jogo-aviso]') || !document.querySelector('[data-historia-conteudo]')?.hidden)`);
            await seguro();
            if(['historia','opcao'].includes(parametro)) assert.equal(await avaliar(`document.querySelector('[data-jogo-aviso]').getAttribute('role')`),'alert');
            ok(`URL ${parametro} e hash não executam: payload ${payloads.indexOf(payload)+1}`);
        }
    }
    await ir('src/pages/inicio.html');await inicioPronto();
    for(const rota of ['javascript:alert(1)','https://example.invalid','//example.invalid','../../index.html','__proto__']) {
        assert.equal(await avaliar(`(async()=>{const m=await import('/src/js/navigation/navigation.js');return m.navegarPara(${JSON.stringify(rota)})})()`),false);
        await seguro();
    }
    ok('navegação rejeita protocolos, URL externa, travessia e nome herdado');
    // Payload também dentro de uma estrutura de progresso com assinatura válida.
    await avaliar(`(async()=>{const m=await import('/src/js/jogo/motor.js');const {historias}=await(await fetch('/src/data/historias.json')).json();const r=m.criarRodada(historias);r.respostas=[{historiaId:r.ordem[0],opcaoId:'javascript:alert(1)'}];r.fase='reflexao';localStorage.setItem(m.CHAVE_PROGRESSO,JSON.stringify(r))})()`);
    await ir('src/pages/inicio.html');await inicioPronto();await seguro();
    assert.match(await avaliar(`document.querySelector('[data-jogo-aviso]').textContent`),/não é compatível/);
    ok('progresso estruturado com opção forjada é rejeitado');

    await call('Page.setBypassCSP',{enabled:false});
    await ir('src/pages/inicio.html');await inicioPronto();
    await clicar('[data-acao="iniciar-jornada"]');await telaPronta('historia');
    for(let i=0;i<5;i++){
        await clicar('[data-opcao-id="a"]');await telaPronta('reflexao');
        await clicar('[data-acao="proxima-historia"]');await telaPronta(i===4?'conclusao':'historia');
    }
    assert.deepEqual(await avaliar('window.__violacoes'),[]);
    ok('jornada completa funciona com CSP ativa');
    const rede=await avaliar(`performance.getEntriesByType('resource').map(r=>r.name)`);
    assert.ok(rede.every(url=>[new URL(base).origin,'https://fonts.googleapis.com','https://fonts.gstatic.com'].includes(new URL(url).origin)));
    assert.ok(await avaliar(`document.fonts.check('700 18px Poppins') && document.fonts.check('400 15px Inter')`));
    ok('recursos limitados à origem e fontes HTTPS permitidas');
    await avaliar(`(()=>{window.__injetado=false;const s=document.createElement('script');s.textContent='window.__injetado=true';document.body.append(s);const externo=document.createElement('script');externo.src='https://example.invalid/injetado.js';document.body.append(externo);const objeto=document.createElement('object');objeto.data='/index.html';document.body.append(objeto);})()`);
    await esperar(`window.__violacoes.some(v=>v.diretiva==='script-src-elem') && window.__violacoes.some(v=>v.diretiva==='object-src')`);
    assert.equal(await avaliar('window.__injetado'),false);
    await esperar(`window.__violacoes.some(v=>v.diretiva==='script-src-elem' && v.bloqueado==='https://example.invalid/injetado.js')`);
    ok('CSP bloqueia script inline, script externo e objeto');
    for(const pagina of ['index.html','src/pages/identificação.html','src/js/main.js','src/data/historias.json','assets/audio/introducao.m4a']) {
        const response=await fetch(new URL(pagina,base));assert.equal(response.status,200);
        assert.equal(response.headers.get('x-content-type-options'),'nosniff');
        assert.equal(response.headers.get('x-frame-options'),'DENY');
        assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
        const mime=response.headers.get('content-type');
        assert.match(mime,pagina.endsWith('.js')?/javascript/:pagina.endsWith('.json')?/application\/json/:pagina.endsWith('.m4a')?/audio\/mp4/:/text\/html/);
    }
    ok('cabeçalhos e MIME locais corretos para HTML, JS, JSON e áudio');
    assert.deepEqual(erros,[]);
    fs.mkdirSync('docs/qa-evidencias', { recursive: true });
    fs.writeFileSync('docs/qa-evidencias/seguranca-navegador.json',JSON.stringify({ambiente:base,resultados,recursos:rede,erros,limite:'Cabeçalhos servidos localmente; não prova configuração do domínio Vercel.'},null,2));
} finally {
    await call('Page.setBypassCSP',{enabled:false});
    if(guarda)await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:guarda.identifier});
    ws.close();
}
