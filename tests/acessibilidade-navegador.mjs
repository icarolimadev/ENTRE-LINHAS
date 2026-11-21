// Chrome isolado em 9222 e servidor em 8765; altera apenas dados do perfil de teste.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { call, avaliar, pausa, esperar, ir, clicar, inicioPronto, telaPronta, ws, erros } from './cdp.mjs';
const resultados = [];
const ok = (nome, dados = {}) => { resultados.push({ nome, ...dados }); console.log(`OK ${resultados.length}: ${nome}`); };
const tecla = async (key, code = key, windowsVirtualKeyCode = key === 'Tab' ? 9 : 13) => {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, ...(key === 'Enter' ? { text: '\r' } : {}) });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
};
async function pronta() {
    await esperar(`document.readyState === 'complete' && (!document.querySelector('[data-historia-conteudo]') || !document.querySelector('[data-historia-conteudo]').hidden)`);
    await avaliar('document.fonts.ready.then(()=>true)');
}
try {
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
    await call('Network.setCacheDisabled', { cacheDisabled: true });
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await ir('index.html');
    await clicar('.abertura__botao');
    await esperar(`location.pathname.endsWith('boas-vindas.html')`);
    ok('movimento reduzido mostra marca estática e avança');
    await call('Emulation.setEmulatedMedia', { features: [] });
    await ir('index.html');
    await esperar(`!!document.querySelector('.intro__marca')`);
    assert.equal(await avaliar(`document.querySelectorAll('video, iframe').length`), 0);
    await tecla('Tab');
    assert.equal(await avaliar(`document.activeElement.classList.contains('abertura__botao')`), true);
    await tecla('Enter');
    assert.equal(await avaliar(`document.activeElement.className`), 'intro__continuar');
    await tecla('Enter'); await esperar(`location.pathname.endsWith('boas-vindas.html')`);
    ok('introdução vetorial pode ser pulada pelo teclado');
    await avaliar(`localStorage.removeItem('entreLinhas.apelido')`);
    await ir('src/pages/identificação.html'); await pronta();
    await tecla('Tab');
    assert.equal(await avaliar(`document.activeElement.id`), 'nome');
    assert.equal(await avaliar(`getComputedStyle(document.activeElement).outlineStyle`), 'solid');
    await call('Input.insertText', { text: '  Ícaro QA  ' }); await tecla('Enter'); await inicioPronto();
    assert.equal(await avaliar(`localStorage.getItem('entreLinhas.apelido')`), 'Ícaro QA');
    ok('Tab, foco visível e Enter salvam apelido sem espaços nas pontas');
    await ir('src/pages/identificação.html'); await pronta();
    await avaliar(`document.querySelector('#nome').value='x'.repeat(41);document.querySelector('form').requestSubmit()`);
    assert.equal(await avaliar(`document.querySelector('#nome').getAttribute('aria-invalid')`), 'true');
    await avaliar(`document.querySelector('#nome').value=' ';document.querySelector('#nome').dispatchEvent(new Event('input'));document.querySelector('form').requestSubmit()`);
    await inicioPronto(); assert.equal(await avaliar(`localStorage.getItem('entreLinhas.apelido')`), null);
    ok('apelido acima do limite é rejeitado e campo vazio permite visitante');
    await avaliar(`localStorage.setItem('entreLinhas.apelido','<img src=x onerror=alert(1)>')`);
    await ir('src/pages/inicio.html'); await inicioPronto();
    assert.equal(await avaliar(`document.querySelector('#titulo-inicio img')`), null);
    assert.match(await avaliar(`document.querySelector('#titulo-inicio').textContent`), /<img/);
    ok('apelido com HTML é exibido como texto');
    await clicar('[data-acao="iniciar-jornada"]'); await telaPronta('historia');
    assert.equal(await avaliar('document.activeElement.tagName'), 'H1');
    await tecla('Tab');
    assert.equal(await avaliar(`document.activeElement.dataset.acao`), 'responder');
    await tecla('Enter'); await telaPronta('reflexao');
    assert.equal(await avaliar('document.activeElement.tagName'), 'H1');
    await tecla('Tab'); await tecla('Enter'); await telaPronta('historia');
    ok('título carregado recebe foco e teclado permite escolher e avançar');

    await call('Network.setCacheDisabled', { cacheDisabled: false });
    const paginas = ['boas-vindas.html', 'identificação.html', 'inicio.html', 'comoFuciona.html', 'creditos.html', 'historia1.html?previa=1&historia=historia-25', 'reflexao1.html?previa=1&historia=historia-25&opcao=b', 'conclusao.html'];
    for (const [width, height] of [[320,568],[390,844],[844,390],[768,1024],[1366,768],[1920,1080]]) {
        await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
        for (const pagina of paginas) {
            if (pagina === 'conclusao.html') {
                await avaliar(`(async()=>{const m=await import('/src/js/jogo/motor.js');const {historias}=await(await fetch('/src/data/historias.json')).json();let r=m.criarRodada(historias);for(let i=0;i<5;i++){r=m.responder(r,historias,r.ordem[r.indice],'a');r=m.avancar(r);}localStorage.setItem(m.CHAVE_PROGRESSO,JSON.stringify(r));})()`);
            }
            await ir(`src/pages/${pagina}`); await pronta();
            await avaliar(`document.querySelectorAll('details').forEach(e=>e.open=true)`);
            for (const ampliado of [false, true]) {
                if (ampliado) await avaliar(`document.documentElement.style.fontSize='200%';`);
                const medidas = await avaliar(`(()=>{
                    const visiveis=[...document.querySelectorAll('button,a,input,summary')].filter(e=>e.checkVisibility() && !e.closest('[hidden]'));
                    const alvos=visiveis.map(e=>{const r=e.getBoundingClientRect();return {texto:e.textContent||e.id,largura:r.width,altura:r.height}});
                    const caixas=[document.documentElement,document.body,document.querySelector('main')];
                    return {overflow:caixas.some(e=>e.scrollWidth>e.clientWidth+1),alvos,imagens:[...document.images].every(i=>i.complete&&i.naturalWidth>0),lang:document.documentElement.lang};
                })()`);
                assert.equal(medidas.overflow, false, `${pagina} ${width} ampliado=${ampliado}: transbordamento horizontal`);
                assert.ok(medidas.alvos.every(a=>a.altura >= 44 && a.largura >= 44), `${pagina}: área de toque pequena ${JSON.stringify(medidas.alvos)}`);
                assert.ok(medidas.imagens); assert.equal(medidas.lang, 'pt-BR');
                // Cada ação deve poder ser trazida à área visível, inclusive com rolagem interna.
                assert.equal(await avaliar(`(()=>{const es=[...document.querySelectorAll('button,a,input,summary')].filter(e=>e.checkVisibility());return es.every(e=>{e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.left>=-1&&r.right<=innerWidth+1;});})()`), true);
                ok(`${pagina} em ${width}x${height}, texto ${ampliado ? '200%' : '100%'}`);
                if (!ampliado && ['inicio.html','historia1.html?previa=1&historia=historia-25','reflexao1.html?previa=1&historia=historia-25&opcao=b'].includes(pagina) && [390,1366].includes(width)) {
                    await avaliar(`window.scrollTo(0,0);document.querySelector('main').scrollTop=0`);
                    const shot=await call('Page.captureScreenshot',{format:'png'});
                    fs.mkdirSync('docs/qa-evidencias',{recursive:true});
                    fs.writeFileSync(`docs/qa-evidencias/${pagina.split('.')[0]}-${width}.png`,Buffer.from(shot.data,'base64'));
                }
            }
        }
    }
    // Contraste das combinações reais de tokens e estados interativos.
    const contrastes = await avaliar(`(()=>{
        const rgb=h=>h.match(/[a-f\\d]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
        const lum=h=>rgb(h).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
        return [['texto/fundo','#F5F5F7','#1C0B2D'],['texto/card','#F5F5F7','#341748'],['secundário/fundo','#CFB9DE','#1C0B2D'],['destaque/card','#DFABFF','#341748'],['botão','#F5F5F7','#8D2FD0'],['hover','#F5F5F7','#7925b5'],['foco/botão','#DFABFF','#8D2FD0'],['borda/campo','#C17DEC','#341748']].map(([nome,a,b])=>({nome,razao:(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05)}));
    })()`);
    for (const c of contrastes) assert.ok(c.razao >= (/foco|borda/.test(c.nome)?3:4.5),JSON.stringify(c));
    ok('contraste de textos, botões, foco e borda', { contrastes });

    const falha = await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.fetch=async()=>{throw new TypeError('Falha de rede simulada')}`});
    await ir('src/pages/historia1.html?rodada=1');
    await esperar(`!!document.querySelector('[data-jogo-aviso] a')`);
    assert.equal(await avaliar(`document.querySelector('[data-jogo-aviso]').contains(document.activeElement)`), true);
    await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:falha.identifier});
    await clicar('[data-jogo-aviso] a'); await inicioPronto();
    ok('falha de rede recebe foco e oferece retorno ao início');
    await avaliar(`localStorage.setItem('qa.outra-chave','preservar');window.confirm=()=>false;document.querySelector('[data-apagar-dados]').click()`);
    assert.equal(await avaliar(`localStorage.getItem('entreLinhas.jornada.v1')!==null`),true);
    await avaliar(`window.confirm=()=>true;document.querySelector('[data-apagar-dados]').click()`);
    await pausa(200); await inicioPronto();
    assert.equal(await avaliar(`localStorage.getItem('entreLinhas.jornada.v1')`),null);
    assert.equal(await avaliar(`localStorage.getItem('entreLinhas.apelido')`),null);
    assert.equal(await avaliar(`localStorage.getItem('qa.outra-chave')`),'preservar');
    ok('cancelar preserva dados; confirmar apaga somente apelido e jornada');
    assert.deepEqual(erros,[]);
} finally {
    fs.mkdirSync('docs/qa-evidencias',{recursive:true});
    fs.writeFileSync('docs/qa-evidencias/acessibilidade.json',JSON.stringify({resultados,erros},null,2));
    ws.close();
}
