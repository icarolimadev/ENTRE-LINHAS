import { navegarPara } from './navigation/navigation.js';
import { validarBiblioteca, criarRodada, responder, avancar, rever, obterConsequencia } from './jogo/motor.js';
import { lerProgresso, salvarProgresso } from './jogo/persistencia.js';

const fonteHistorias = new URL('../data/historias.json', import.meta.url);
let inicializado = false;

export function selecionarHistoria(dados, id) {
    const historias = validarBiblioteca(dados);
    const indice = historias.findIndex((historia) => historia.id === id);
    if (indice < 0) throw new Error('História não encontrada.');
    return { historia: historias[indice], indice, total: historias.length,
        proximaId: historias[indice + 1]?.id ?? '' };
}

function mostrarHistoria(tela, historia, indice, total, resposta, previa) {
    const preencher = (seletor, texto) => { tela.querySelector(seletor).textContent = texto; };
    tela.dataset.historiaId = historia.id;
    if (tela.dataset.telaHistoria === 'historia') {
        document.title = `${historia.titulo} | Entre Linhas`;
        preencher('#titulo-historia', historia.titulo);
        preencher('.historia__etapa', previa ? `Biblioteca · ${indice + 1} de ${total}` : `História ${indice + 1} de ${total}`);
        preencher('#titulo-pergunta', historia.pergunta);
        preencher('.historia__descricao', historia.situacao);
        const marcadores = tela.querySelector('.historia__marcadores');
        marcadores.replaceChildren();
        marcadores.hidden = previa;
        for (let i = 0; !previa && i < total; i++) {
            const marcador = document.createElement('span');
            marcador.className = 'historia__marcador' + (i <= indice ? ' historia__marcador--atual' : '');
            marcadores.append(marcador);
        }
        const opcoes = tela.querySelector('.historia__opcoes');
        opcoes.replaceChildren();
        historia.opcoes.forEach((opcao) => {
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.textContent = `${opcao.id.toUpperCase()}) ${opcao.texto}`;
            botao.dataset.acao = 'responder';
            botao.dataset.historiaId = historia.id;
            botao.dataset.opcaoId = opcao.id;
            botao.disabled = previa;
            botao.setAttribute('aria-pressed', String(resposta?.opcaoId === opcao.id));
            opcoes.append(botao);
        });
    } else {
        document.title = `Reflexão da História ${indice + 1} | Entre Linhas`;
        preencher('.reflexao__etapa', `História ${indice + 1}`);
        preencher('#titulo-impacto', historia.reflexao.titulo);
        preencher('[aria-labelledby="titulo-impacto"] .reflexao__descricao', obterConsequencia(historia, resposta?.opcaoId));
        preencher('[aria-labelledby="titulo-refletir"] .reflexao__descricao', historia.reflexao.pergunta);
        preencher('[data-proxima-rotulo]', indice < total - 1 ? 'Próxima história' : 'Concluir jornada');
        tela.querySelectorAll('[data-acao]').forEach((botao) => { botao.disabled = previa; });
    }
    tela.querySelector('[data-historia-aviso]').hidden = true;
    tela.querySelector('[data-historia-conteudo]').hidden = false;
}

export async function inicializarHistoria() {
    const tela = document.querySelector('[data-tela-historia]');
    const iniciar = document.querySelector('[data-acao="iniciar-jornada"]');
    const conclusao = document.querySelector('.pagina-conclusao');
    if ((!tela && !iniciar && !conclusao) || inicializado) return;
    inicializado = true;
    const parametros = new URLSearchParams(window.location.search);
    // Links antigos com apenas ?historia=... continuam úteis para revisão, sem alterar a rodada.
    const previa = !!tela && (parametros.get('previa') === '1' ||
        (parametros.has('historia') && parametros.get('rodada') !== '1'));
    let historias, rodada, bruto, ocupado = false;
    const conteudo = document.querySelector('[data-historia-conteudo]');
    const acoes = () => document.querySelectorAll('[data-acao]');
    const bloquear = (valor) => acoes().forEach((botao) => { botao.disabled = valor; });

    function avisar(mensagem, erro = false) {
        let aviso = document.querySelector('[data-jogo-aviso]');
        if (!aviso) {
            aviso = document.createElement('div');
            aviso.dataset.jogoAviso = '';
            aviso.className = 'jogo__aviso';
            const alvo = document.querySelector('.inicio__conteudo, .historia__conteudo, .reflexao__conteudo, .conclusao__conteudo');
            alvo.before(aviso);
        }
        aviso.setAttribute('role', erro ? 'alert' : 'status');
        aviso.replaceChildren();
        const texto = document.createElement('p');
        texto.textContent = mensagem;
        aviso.append(texto);
        if (erro) {
            const tentar = document.createElement('button');
            tentar.type = 'button';
            tentar.textContent = 'Tentar novamente';
            tentar.addEventListener('click', () => window.location.reload());
            aviso.append(tentar);
        }
    }

    function falhar(erro) {
        ocupado = false;
        bloquear(true);
        const carregando = document.querySelector('[data-historia-aviso]');
        if (carregando) carregando.hidden = true;
        avisar(erro.message || 'Não foi possível carregar a jornada. Tente novamente.', true);
        console.error('[Jornada]', erro);
    }

    function salvar(proxima) {
        try {
            bruto = salvarProgresso(window.localStorage, proxima, bruto);
            rodada = proxima;
        } catch (erro) {
            if (erro.message.includes('outra aba')) throw erro;
            throw new Error('Não foi possível salvar sua jornada. Libere o armazenamento do navegador e tente novamente. Seu último avanço salvo foi preservado.');
        }
    }

    function destinoAtual(substituir = false) {
        const rota = rodada.fase === 'concluida' ? 'conclusao' : rodada.fase === 'reflexao' ? 'reflexao1' : 'historia1';
        const parametros = rodada.fase === 'concluida' ? {} : { rodada: '1', historia: rodada.ordem[rodada.indice] };
        if (!navegarPara(rota, { substituir, parametros })) throw new Error('Não foi possível abrir a próxima tela. Tente novamente.');
    }

    bloquear(true);
    try {
        const resposta = await fetch(fonteHistorias, { cache: 'no-cache' });
        if (!resposta.ok) throw new Error('Não foi possível carregar as histórias. Tente novamente.');
        historias = validarBiblioteca(await resposta.json());
        if (previa) {
            const { historia, indice, total } = selecionarHistoria({ historias }, parametros.get('historia') || tela.dataset.historiaId);
            const opcaoId = parametros.get('opcao');
            if (opcaoId && !historia.opcoes.some((opcao) => opcao.id === opcaoId)) throw new Error('Alternativa não encontrada.');
            mostrarHistoria(tela, historia, indice, total, opcaoId ? { opcaoId } : null, true);
            avisar('Prévia para revisão. Para jogar e salvar suas escolhas, comece pela tela inicial.');
            return;
        }
        let leitura;
        try { leitura = lerProgresso(window.localStorage, historias); }
        catch { throw new Error('O armazenamento do navegador está indisponível. Libere-o para salvar e continuar sua jornada.'); }
        ({ rodada, bruto } = leitura);
        if (leitura.recuperado) avisar('O progresso anterior não é compatível com as histórias atuais. Uma nova jornada será iniciada.');

        if (iniciar) {
            iniciar.innerHTML = '';
            iniciar.append(document.createTextNode(rodada && rodada.fase !== 'concluida' ? 'Continuar jornada ' : 'Jogar agora '));
            const seta = document.createElement('span');
            seta.setAttribute('aria-hidden', 'true');
            seta.textContent = '→';
            iniciar.append(seta);
        } else {
            if (!rodada) salvar(criarRodada(historias));
            const faseTela = conclusao ? 'concluida' : tela.dataset.telaHistoria === 'reflexao' ? 'reflexao' : 'situacao';
            if (faseTela !== rodada.fase) { destinoAtual(true); return; }
            if (conclusao) {
                document.querySelector('#titulo-jornada-concluida').textContent = `Você percorreu as ${rodada.ordem.length} histórias`;
                conteudo.hidden = false;
            } else {
                const id = rodada.ordem[rodada.indice];
                const url = new URL(window.location.href);
                url.searchParams.set('rodada', '1');
                url.searchParams.set('historia', id);
                window.history.replaceState(null, '', url);
                mostrarHistoria(tela, historias.find((historia) => historia.id === id), rodada.indice,
                    rodada.ordem.length, rodada.respostas[rodada.indice], false);
            }
        }
        bloquear(false);
    } catch (erro) { falhar(erro); return; }

    document.addEventListener('click', (evento) => {
        const botao = evento.target.closest('[data-acao]');
        if (!botao || botao.disabled || ocupado || evento.defaultPrevented) return;
        evento.preventDefault();
        ocupado = true;
        bloquear(true);
        try {
            switch (botao.dataset.acao) {
                case 'iniciar-jornada':
                    if (!rodada || rodada.fase === 'concluida') salvar(criarRodada(historias, rodada));
                    break;
                case 'responder':
                    salvar(responder(rodada, historias, botao.dataset.historiaId, botao.dataset.opcaoId));
                    break;
                case 'proxima-historia': salvar(avancar(rodada)); break;
                case 'rever-historia': salvar(rever(rodada)); break;
                case 'jogar-novamente': salvar(criarRodada(historias, rodada)); break;
                case 'voltar-inicio':
                    if (!navegarPara('inicio')) throw new Error('Não foi possível voltar ao início.');
                    return;
                default: ocupado = false; bloquear(false); return;
            }
            destinoAtual();
        } catch (erro) { falhar(erro); }
    });

    // O cache de voltar/avançar não deve restaurar botões ou etapas antigas.
    window.addEventListener('pageshow', (evento) => { if (evento.persisted) window.location.reload(); });
    window.addEventListener('storage', (evento) => {
        if (evento.key === 'entreLinhas.jornada.v1' || evento.key === null) {
            falhar(new Error('A jornada mudou em outra aba. Recarregue para continuar do ponto salvo.'));
        }
    });
}
