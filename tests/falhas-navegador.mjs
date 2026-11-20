import assert from 'node:assert/strict';
import fs from 'node:fs';
import { call, avaliar, esperar, ir, clicar, inicioPronto, ws, erros } from './cdp.mjs';
const casos=[];
try {
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    for(const [nome,source] of [
        ['HTTP 503',`window.fetch=async()=>new Response('',{status:503})`],
        ['JSON inválido',`window.fetch=async()=>new Response('{quebrado',{status:200})`],
        ['tempo limite',`window.fetch=(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Tempo esgotado','AbortError'))))`],
        ['biblioteca inválida',`window.fetch=async()=>new Response(JSON.stringify({historias:[]}),{status:200})`],
    ]) {
        const injecao=await call('Page.addScriptToEvaluateOnNewDocument',{source});
        await ir('src/pages/inicio.html');
        // O cenário de timeout usa os 15 segundos reais da aplicação.
        if(nome==='tempo limite') await new Promise(resolve=>setTimeout(resolve,15000));
        await esperar(`document.querySelector('[data-jogo-aviso]')?.getAttribute('role')==='alert'`);
        const mensagem=await avaliar(`document.querySelector('[data-jogo-aviso]').textContent`);
        assert.match(mensagem,nome==='biblioteca inválida'?/pelo menos cinco histórias/:/Verifique sua conexão/);
        assert.equal(await avaliar(`document.querySelector('[data-acao="iniciar-jornada"]').disabled`),true);
        await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injecao.identifier});
        await clicar('[data-jogo-aviso] button'); await inicioPronto();
        casos.push(`${nome}: mensagem acessível e nova tentativa recupera`);
    }
    const bloqueio=await call('Page.addScriptToEvaluateOnNewDocument',{source:`Storage.prototype.setItem=function(){throw new DOMException('Quota','QuotaExceededError')}`});
    await ir('src/pages/identificação.html');
    await esperar(`document.readyState==='complete'`);
    await avaliar(`document.querySelector('#nome').value='Teste';document.querySelector('form').requestSubmit()`);
    await esperar(`document.querySelector('#aviso-prototipo').textContent.includes('Não foi possível salvar')`);
    assert.ok((await avaliar('location.pathname')).includes('identifica'));
    await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:bloqueio.identifier});
    casos.push('quota no apelido informa falha e preserva a tela');
    await ir('src/pages/inicio.html'); await inicioPronto();
    for (const [rota,pagina] of [['comoFuciona','comoFuciona.html'],['creditos','creditos.html']]) {
        await clicar(`[data-rota="${rota}"]`);
        await esperar(`location.pathname.endsWith('${pagina}') && document.readyState==='complete'`);
        await clicar('[data-rota="inicio"]'); await inicioPronto();
        casos.push(`${rota}: ida e volta funcionam`);
    }
    await call('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});
    await call('Network.setCacheDisabled',{cacheDisabled:true});
    await ir('src/pages/inicio.html'); await inicioPronto();
    assert.ok(await avaliar(`getComputedStyle(document.querySelector('#titulo-inicio')).fontFamily.includes('sans-serif')`));
    assert.ok(await avaliar(`document.body.scrollWidth <= innerWidth`));
    await call('Network.setBlockedURLs',{urls:[]});
    casos.push('fontes externas indisponíveis mantêm conteúdo e ações utilizáveis');
    assert.deepEqual(erros,[]);
    console.log(JSON.stringify({casos,erros},null,2));
    fs.writeFileSync('docs/qa-evidencias/falhas.json',JSON.stringify({casos,erros},null,2));
} finally { ws.close(); }
