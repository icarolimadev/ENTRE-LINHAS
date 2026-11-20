export const TOTAL_HISTORIAS = 5;
export const CHAVE_PROGRESSO = 'entreLinhas.jornada.v1';

const texto = (valor) => typeof valor === 'string' && valor.trim().length > 0;

export function validarBiblioteca(dados) {
    if (!Array.isArray(dados?.historias) || dados.historias.length < TOTAL_HISTORIAS) {
        throw new Error('A jornada precisa de pelo menos cinco histórias.');
    }
    const ids = new Set();
    for (const historia of dados.historias) {
        if (!historia || !texto(historia.id) || ids.has(historia.id) ||
            !['titulo', 'situacao', 'pergunta'].every((campo) => texto(historia[campo])) ||
            !Array.isArray(historia.opcoes) || historia.opcoes.length !== 3 ||
            historia.opcoes.some((opcao) => !opcao || !texto(opcao.id) || !texto(opcao.texto) ||
                (opcao.consequencia != null && typeof opcao.consequencia !== 'string')) ||
            new Set(historia.opcoes.map((opcao) => opcao.id)).size !== 3 ||
            !['titulo', 'texto', 'pergunta'].every((campo) => texto(historia.reflexao?.[campo]))) {
            throw new Error('Confira os identificadores, as três alternativas e a reflexão de cada história.');
        }
        ids.add(historia.id);
    }
    return dados.historias;
}

// Alterações editoriais invalidam uma rodada antiga, evitando respostas ligadas a outro texto.
export function assinaturaBiblioteca(historias) {
    return JSON.stringify(historias.map(({ id, titulo, situacao, pergunta, opcoes, reflexao }) =>
        ({ id, titulo, situacao, pergunta, opcoes, reflexao })));
}

export function criarRodada(historias, anterior = null, aleatorio = Math.random) {
    const ordem = historias.map((historia) => historia.id);
    for (let i = ordem.length - 1; i > 0; i--) {
        const j = Math.floor(aleatorio() * (i + 1));
        [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    }
    // Evita repetir imediatamente a última história da rodada anterior.
    if (anterior && ordem[0] === anterior.ordem.at(-1)) {
        [ordem[0], ordem[1]] = [ordem[1], ordem[0]];
    }
    if (anterior && ordem.slice(0, TOTAL_HISTORIAS).join('|') === anterior.ordem.join('|')) {
        [ordem[1], ordem[2]] = [ordem[2], ordem[1]];
    }
    return {
        versao: 1,
        biblioteca: assinaturaBiblioteca(historias),
        ordem: ordem.slice(0, TOTAL_HISTORIAS),
        indice: 0,
        fase: 'situacao',
        respostas: [],
        revisao: (anterior?.revisao ?? 0) + 1,
    };
}

export function validarRodada(rodada, historias) {
    if (!rodada || rodada.versao !== 1 || rodada.biblioteca !== assinaturaBiblioteca(historias) ||
        !Array.isArray(rodada.ordem) || rodada.ordem.length !== TOTAL_HISTORIAS ||
        new Set(rodada.ordem).size !== TOTAL_HISTORIAS ||
        rodada.ordem.some((id) => !historias.some((historia) => historia.id === id)) ||
        !Number.isInteger(rodada.indice) || rodada.indice < 0 || rodada.indice >= TOTAL_HISTORIAS ||
        !Number.isSafeInteger(rodada.revisao) || rodada.revisao < 1 ||
        !['situacao', 'reflexao', 'concluida'].includes(rodada.fase) ||
        !Array.isArray(rodada.respostas)) return false;

    const quantidade = rodada.respostas.length;
    if (quantidade < rodada.indice || quantidade > rodada.indice + 1 ||
        (rodada.fase !== 'situacao' && quantidade !== rodada.indice + 1) ||
        (rodada.fase === 'concluida' && rodada.indice !== TOTAL_HISTORIAS - 1)) return false;
    return rodada.respostas.every((resposta, indice) => {
        const historia = historias.find((item) => item.id === rodada.ordem[indice]);
        return resposta?.historiaId === historia.id && historia.opcoes.some((opcao) => opcao.id === resposta.opcaoId);
    });
}

export function responder(rodada, historias, historiaId, opcaoId) {
    if (rodada.fase !== 'situacao' || historiaId !== rodada.ordem[rodada.indice]) {
        throw new Error('Esta situação já foi respondida ou não é a etapa atual.');
    }
    const historia = historias.find((item) => item.id === historiaId);
    if (!historia?.opcoes.some((opcao) => opcao.id === opcaoId)) throw new Error('Alternativa inválida.');
    const respostas = rodada.respostas.slice(0, rodada.indice);
    respostas.push({ historiaId, opcaoId });
    return { ...rodada, respostas, fase: 'reflexao', revisao: rodada.revisao + 1 };
}

export function avancar(rodada) {
    if (rodada.fase !== 'reflexao') throw new Error('Escolha uma alternativa antes de avançar.');
    const ultima = rodada.indice === rodada.ordem.length - 1;
    return { ...rodada, indice: ultima ? rodada.indice : rodada.indice + 1,
        fase: ultima ? 'concluida' : 'situacao', revisao: rodada.revisao + 1 };
}

export function rever(rodada) {
    if (rodada.fase !== 'reflexao') throw new Error('Não há reflexão para rever.');
    return { ...rodada, fase: 'situacao', revisao: rodada.revisao + 1 };
}

export function obterConsequencia(historia, opcaoId) {
    const opcao = historia.opcoes.find((item) => item.id === opcaoId);
    return opcao?.consequencia?.trim() || historia.reflexao.texto;
}
