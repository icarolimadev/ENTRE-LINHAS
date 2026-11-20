import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validarBiblioteca, criarRodada, validarRodada, responder, avancar, rever, obterConsequencia, CHAVE_PROGRESSO } from '../src/js/jogo/motor.js';
import { lerProgresso, salvarProgresso } from '../src/js/jogo/persistencia.js';

const historias = validarBiblioteca(JSON.parse(readFileSync(new URL('../src/data/historias.json', import.meta.url), 'utf8')));
const clone = (valor) => JSON.parse(JSON.stringify(valor));
const storage = () => {
    const dados = new Map();
    return { getItem: (chave) => dados.get(chave) ?? null, setItem: (chave, valor) => dados.set(chave, valor) };
};

test('biblioteca tem 30 histórias adaptadas e 90 consequências específicas', () => {
    assert.equal(historias.length, 30);
    historias.forEach((historia, indice) => {
        assert.equal(historia.id, `historia-${indice + 1}`);
        assert.equal(historia.origem.numero, indice + 1);
        assert.equal(historia.origem.arquivo, 'docs/historias.md');
        assert.equal(historia.opcoes.length, 3);
        assert.equal(new Set(historia.opcoes.map((opcao) => opcao.consequencia)).size, 3);
        for (const opcao of historia.opcoes) {
            assert.ok(opcao.consequencia.trim());
            assert.equal(obterConsequencia(historia, opcao.id), opcao.consequencia);
        }
    });
});

test('rejeita IDs repetidos, reflexão incompleta e alternativas inválidas', () => {
    for (const alterar of [
        (h) => { h[1].id = h[0].id; },
        (h) => { h[0].opcoes[1].id = h[0].opcoes[0].id; },
        (h) => { h[0].opcoes.pop(); },
        (h) => { h[0].reflexao.pergunta = ''; },
        (h) => { h[0].opcoes[0].consequencia = {}; },
    ]) {
        const copia = clone(historias); alterar(copia);
        assert.throws(() => validarBiblioteca({ historias: copia }));
    }
});

test('100 rodadas têm cinco IDs únicos e somente histórias da biblioteca', () => {
    for (let i = 0; i < 100; i++) {
        const rodada = criarRodada(historias);
        assert.equal(new Set(rodada.ordem).size, 5);
        assert.ok(validarRodada(rodada, historias));
    }
});

test('nova rodada altera ordem e evita começar pela última história anterior', () => {
    let anterior = criarRodada(historias, null, () => 0);
    for (const rng of [() => 0, () => 0.99, () => 0.5]) {
        const nova = criarRodada(historias, anterior, rng);
        assert.notDeepEqual(nova.ordem, anterior.ordem);
        assert.notEqual(nova.ordem[0], anterior.ordem.at(-1));
        assert.deepEqual(nova.respostas, []);
        anterior = nova;
    }
});

test('fluxo completo exige resposta e reflexão em todas as cinco etapas', () => {
    let rodada = criarRodada(historias);
    for (let i = 0; i < 5; i++) {
        assert.equal(rodada.indice, i);
        assert.throws(() => avancar(rodada));
        const historia = historias.find((h) => h.id === rodada.ordem[i]);
        rodada = responder(rodada, historias, historia.id, historia.opcoes[0].id);
        assert.throws(() => responder(rodada, historias, historia.id, historia.opcoes[0].id));
        rodada = avancar(rodada);
        assert.ok(validarRodada(rodada, historias));
    }
    assert.equal(rodada.fase, 'concluida');
    assert.equal(rodada.respostas.length, 5);
    assert.throws(() => avancar(rodada));
});

test('rever permite trocar alternativa sem duplicar resposta ou avançar etapa', () => {
    let rodada = criarRodada(historias);
    const historia = historias.find((h) => h.id === rodada.ordem[0]);
    rodada = responder(rodada, historias, historia.id, historia.opcoes[0].id);
    rodada = rever(rodada);
    assert.ok(validarRodada(rodada, historias));
    rodada = responder(rodada, historias, historia.id, historia.opcoes[1].id);
    assert.equal(rodada.respostas.length, 1);
    assert.equal(rodada.respostas[0].opcaoId, historia.opcoes[1].id);
    assert.equal(rodada.indice, 0);
});

test('não aceita escolha de outra história nem opção inexistente', () => {
    const rodada = criarRodada(historias);
    assert.throws(() => responder(rodada, historias, rodada.ordem[1], 'a'));
    assert.throws(() => responder(rodada, historias, rodada.ordem[0], 'inexistente'));
});

test('consequência por alternativa tem prioridade e reflexão geral é fallback', () => {
    const historia = clone(historias[0]);
    delete historia.opcoes[0].consequencia;
    assert.equal(obterConsequencia(historia, 'a'), historia.reflexao.texto);
    historia.opcoes[0].consequencia = 'Retorno de teste da alternativa A';
    historia.opcoes[1].consequencia = 'Retorno de teste da alternativa B';
    assert.equal(obterConsequencia(historia, 'a'), historia.opcoes[0].consequencia);
    assert.equal(obterConsequencia(historia, 'b'), historia.opcoes[1].consequencia);
    historia.opcoes[2].consequencia = '  ';
    assert.equal(obterConsequencia(historia, 'c'), historia.reflexao.texto);
});

test('o sorteio alcança toda a biblioteca, mantendo cinco histórias por rodada', () => {
    let semente = 42;
    const aleatorio = () => ((semente = (1664525 * semente + 1013904223) >>> 0) / 2 ** 32);
    const sorteadas = new Set();
    for (let i = 0; i < 100; i++) {
        const rodada = criarRodada(historias, null, aleatorio);
        assert.equal(rodada.ordem.length, 5);
        rodada.ordem.forEach((id) => sorteadas.add(id));
    }
    assert.equal(sorteadas.size, 30);
});

test('progresso salvo retoma fase e resposta e preserva apelido', () => {
    const local = storage(); local.setItem('entreLinhas.apelido', 'Visitante teste');
    let rodada = criarRodada(historias);
    rodada = responder(rodada, historias, rodada.ordem[0], 'a');
    salvarProgresso(local, rodada, null);
    assert.deepEqual(lerProgresso(local, historias).rodada, rodada);
    assert.equal(local.getItem('entreLinhas.apelido'), 'Visitante teste');
});

test('progresso corrompido ou incompatível é recuperável sem apagar outras chaves', () => {
    const local = storage(); local.setItem(CHAVE_PROGRESSO, '{quebrado');
    assert.equal(lerProgresso(local, historias).recuperado, true);
    const rodada = criarRodada(historias);
    salvarProgresso(local, rodada, '{quebrado');
    const editadas = clone(historias); editadas[0].situacao = 'Nova situação';
    assert.equal(lerProgresso(local, editadas).rodada, null);
    assert.equal(lerProgresso(local, editadas).recuperado, true);
});

test('rejeita etapas forjadas, conclusão antecipada e respostas desconhecidas', () => {
    const base = criarRodada(historias);
    for (const alterar of [
        (r) => { r.indice = 4; },
        (r) => { r.fase = 'concluida'; },
        (r) => { r.revisao = -1; },
        (r) => { r.ordem[1] = r.ordem[0]; },
        (r) => { r.respostas = [{historiaId:r.ordem[0],opcaoId:'z'}]; },
    ]) {
        const rodada = clone(base); alterar(rodada);
        assert.equal(validarRodada(rodada, historias), false);
    }
});

test('escrita falha não apaga o progresso anterior; estado de outra aba não é sobrescrito', () => {
    const local = storage(); const rodada = criarRodada(historias);
    const bruto = salvarProgresso(local, rodada, null);
    assert.throws(() => salvarProgresso(local, rodada, null), /outra aba/);
    const indisponivel = {getItem:local.getItem,setItem(){throw new Error('QuotaExceededError')}};
    assert.throws(() => salvarProgresso(indisponivel, rodada, bruto));
    assert.equal(local.getItem(CHAVE_PROGRESSO), bruto);
});
