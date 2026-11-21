// Medidas da referência de 8 s. Todas as durações e trajetórias ficam aqui.
export const INTRODUCAO = Object.freeze({
    duracao: 8000,
    saida: 350,
    estatica: 1400,
    curva: 'cubic-bezier(.22,.61,.36,1)',
    // Ordem de pintura: vermelho, laranja, amarelo, roxo claro, azul, verde, roxo escuro.
    // Cada ponto: [tempo absoluto em ms, deslocamento X, Y, rotação em graus].
    pecas: [
        [[250,-600,-1300,-25],[500,-371,-641,-15],[750,-188,-272,-5],[1000,-77,-66,-1],[1250,-20,0,0],[1500,0,0,0]],
        [[750,650,-1300,28],[1000,289,-497,15],[1250,148,-201,7],[1500,58,-44,2],[1750,24,-9,1],[2000,0,0,0]],
        [[1250,-520,1060,25],[1500,-249,385,14],[1750,-123,146,6],[2000,-47,24,3],[2250,-13,1,0],[2500,0,0,0]],
        [[1750,348,766,-16],[2000,172,308,-5],[2250,86,101,-2],[2500,40,20,0],[2750,0,0,0]],
        [[2000,-650,250,-30],[2250,-343,115,-15],[2500,-161,39,-7],[2750,-71,8,-3],[3000,-20,0,0],[3250,0,0,0]],
        [[2500,580,-300,24],[2750,273,-131,14],[3000,121,-46,4],[3250,52,-13,1],[3500,15,0,0],[3750,0,0,0]],
        [[2750,-110,-1450,-20],[3000,-70,-973,-15],[3250,-38,-455,-8],[3500,-43,-138,-3],[3750,-30,-26,-1],[4000,0,0,0]],
    ],
    arco: { atraso: 2550, duracao: 2100 },
    letras: { atraso: 2750, intervalo: 39, duracao: 850 },
});

const intro = document.querySelector('.intro');
if (intro) iniciarIntroducao(intro);

function iniciarIntroducao(elemento) {
    const marca = elemento.querySelector('.intro__marca');
    const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animacoes = [];
    const temporizadores = [];
    let encerrada = false;
    let audio;
    const agendar = (acao, ms) => temporizadores.push(window.setTimeout(acao, ms));
    const avancar = () => document.dispatchEvent(new Event('intro:avancar'));
    function limpar() {
        animacoes.forEach((animacao) => animacao.cancel());
        temporizadores.forEach((id) => clearTimeout(id));
        elemento.classList.remove('intro--animando');
        elemento.querySelectorAll('.intro__rastro').forEach((rastro) => rastro.remove());
        if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
    }
    function encerrar() {
        if (encerrada) return;
        encerrada = true;
        // Mantém a saída preta enquanto o próximo documento carrega.
        marca.setAttribute('visibility', 'hidden');
        limpar();
        preferencia.removeEventListener('change', reduzir);
        document.removeEventListener('intro:encerrar', encerrar);
    }
    function reduzir() {
        if (!preferencia.matches || encerrada) return;
        limpar();
        agendar(avancar, INTRODUCAO.estatica);
    }
    document.addEventListener('intro:encerrar', encerrar);
    window.addEventListener('pagehide', encerrar, { once: true });
    preferencia.addEventListener('change', reduzir);
    if (preferencia.matches || !marca.animate) {
        agendar(avancar, INTRODUCAO.estatica);
        return;
    }
    try {
        elemento.classList.add('intro--animando');
        elemento.querySelectorAll('[data-peca]').forEach((peca, i) => {
            const pontos = INTRODUCAO.pecas[i];
            const atraso = pontos[0][0];
            const duracao = pontos.at(-1)[0] - atraso;
            const quadros = pontos.map(([tempo, x, y, rotacao]) => ({
                offset: (tempo - atraso) / duracao,
                transform: `translate(${x}px, ${y}px) rotate(${rotacao}deg)`,
                opacity: 1,
                easing: 'cubic-bezier(.33,.42,.67,.78)',
            }));
            // Dois ecos vetoriais discretos reproduzem o rastro da referência.
            for (const [defasagem, opacidade] of [[70, .08], [35, .16]]) {
                const rastro = peca.cloneNode(true);
                rastro.removeAttribute('data-peca');
                rastro.classList.add('intro__rastro');
                peca.before(rastro);
                animacoes.push(rastro.animate(quadros.map((quadro, indice) => ({
                    ...quadro, opacity: indice === quadros.length - 1 ? 0 : opacidade,
                })), { delay: atraso + defasagem, duration: duracao, fill: 'forwards' }));
            }
            animacoes.push(peca.animate(quadros, { delay: atraso, duration: duracao, fill: 'forwards' }));
        });
        animacoes.push(elemento.querySelector('.intro__arco').animate([
            { strokeDashoffset: 1, transform: 'rotate(-55deg)', opacity: 0 },
            { strokeDashoffset: .73, transform: 'rotate(-25deg)', opacity: 1, offset: .214 },
            { strokeDashoffset: .42, transform: 'rotate(-10deg)', opacity: 1, offset: .45 },
            { strokeDashoffset: .14, transform: 'rotate(0deg)', opacity: 1, offset: .69 },
            { strokeDashoffset: 0, transform: 'rotate(0deg)', opacity: 1 },
        ], { delay: INTRODUCAO.arco.atraso, duration: INTRODUCAO.arco.duracao, easing: 'linear', fill: 'both' }));
        elemento.querySelectorAll('[data-letra]').forEach((letra, i) => {
            // Chegada em cascata, de baixo para cima ao longo da inscrição original.
            const angulo = i * 2.39996;
            const x = Math.sin(angulo) * 380;
            const y = i < 26 ? 650 + Math.cos(angulo) * 420 : -1400 - Math.sin(angulo) * 300;
            animacoes.push(letra.animate([
                { transform: `translate(${x}px, ${y}px) rotate(${(i % 2 ? 1 : -1) * 130}deg) scale(.65)`, opacity: 0 },
                { opacity: 1, offset: .18 },
                { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
            ], { delay: INTRODUCAO.letras.atraso + i * INTRODUCAO.letras.intervalo,
                duration: INTRODUCAO.letras.duracao, easing: INTRODUCAO.curva, fill: 'both' }));
        });
        animacoes.push(marca.animate([{ opacity: 1 }, { opacity: 0 }], {
            delay: INTRODUCAO.duracao - INTRODUCAO.saida,
            duration: INTRODUCAO.saida, fill: 'forwards', easing: 'ease-in-out',
        }));
        // Falhas de áudio não alteram nem a sequência visual nem seu prazo.
        try {
            audio = new Audio(new URL('../../../assets/audio/introducao.m4a', import.meta.url).href);
            audio.preload = 'auto';
            const inicio = performance.now();
            audio.addEventListener('playing', () => {
                const tempo = (performance.now() - inicio) / 1000;
                if (tempo < audio.duration) audio.currentTime = tempo;
            }, { once: true });
            audio.play().catch(() => {});
        } catch { /* Áudio indisponível: a introdução segue em silêncio. */ }
        agendar(avancar, INTRODUCAO.duracao);
    } catch {
        // Uma API indisponível não deixa uma composição incompleta na tela.
        limpar();
        agendar(avancar, INTRODUCAO.estatica);
    }
}
