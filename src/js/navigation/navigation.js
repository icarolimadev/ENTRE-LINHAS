// ============================================================
// 1. CADASTRO DAS ROTAS
// ============================================================

// A raiz é calculada a partir deste arquivo (src/js/navigation/navigation.js),
// independentemente da página aberta ou da subpasta de hospedagem.

 const BASE_URL = new URL('../../../', import.meta.url).href;

// Cadastre cada nova página aqui, com um nome único e um caminho
// relativo à raiz do projeto, sem começar com "/".
// Exemplo: creditos: 'src/pages/creditos.html',
// Object.freeze impede alterações acidentais durante a execução.
 const ROTAS = Object.freeze({
  entrada: 'index.html',
  boasVindas: 'src/pages/boas-vindas.html',
  identificacao: 'src/pages/identificação.html',
  inicio: 'src/pages/inicio.html',
  comoFuciona: 'src/pages/comoFuciona.html',
  creditos: 'src/pages/creditos.html',
  historia1: 'src/pages/historia1.html',
});

// ============================================================
// 2. TRANSIÇÃO DO VÍDEO
// ============================================================

// Espera após o vídeo terminar: 1000 ms = 1 segundo; 0 = imediato.
const ESPERA_APOS_VIDEO_MS = 0;

// Limite de espera sem avanço do vídeo, não de duração total.
const LIMITE_SEM_PROGRESSO_MS = 10000;
const videosInicializados = new WeakSet();

 function iniciarIntroducao() {
  const video = document.querySelector('.intro__video');
  if (!video) {
    if (document.body.classList.contains('pagina-entrada')) {
      registrarErro(new Error('Elemento .intro__video ausente.'), 'A introdução está indisponível. Abrindo as boas-vindas.', false);
      navegarPara('boasVindas', { substituir: true });
    }
    return;
  }
  if (videosInicializados.has(video)) return;
  videosInicializados.add(video);

  let tentativa = 0;
  let finalizado = false;
  let limparTentativa = () => {};

  function abrirBoasVindas(esperaMs = 0) {
    if (finalizado) return;
    finalizado = true;
    limparTentativa();
    video.pause();
    const navegar = () => {
      // Substitui a introdução no histórico para não repeti-la ao voltar.
      navegarPara('boasVindas', { substituir: true });
    };
    if (esperaMs > 0) {
      window.setTimeout(navegar, esperaMs);
    } else {
      navegar();
    }
  }

  function aoTerminarVideo() {
    abrirBoasVindas(ESPERA_APOS_VIDEO_MS);
  }

  function tentarReproduzir() {
    tentativa += 1;
    const tentativaAtual = tentativa;
    let falhou = false;
    let ultimoTempo = video.currentTime;
    let ultimoProgresso = Date.now();

    function tratarFalha(erro) {
      // Eventos e promises da tentativa anterior não podem iniciar outra.
      if (finalizado || falhou || tentativaAtual !== tentativa) return;
      falhou = true;
      registrarErro(erro || video.error || new Error('Vídeo sem progresso.'), `Falha na tentativa ${tentativaAtual} do vídeo.`, false);
      limparTentativa();
      if (tentativaAtual < 2) {
        tentarReproduzir();
      } else {
        abrirBoasVindas();
      }
    }

    const monitor = window.setInterval(() => {
      // Abas ocultas podem ter reprodução e temporizadores suspensos.
      if (document.hidden) {
        ultimoProgresso = Date.now();
        ultimoTempo = video.currentTime;
        return;
      }
      if (video.currentTime > ultimoTempo) {
        ultimoTempo = video.currentTime;
        ultimoProgresso = Date.now();
      } else if (Date.now() - ultimoProgresso >= LIMITE_SEM_PROGRESSO_MS) {
        tratarFalha();
      }
    }, 1000);

    // Captura também erros de <source>, que não propagam por bubbling.
    const retomarMonitoramento = () => { ultimoProgresso = Date.now(); };
    document.addEventListener('visibilitychange', retomarMonitoramento);
    video.addEventListener('error', tratarFalha, true);
    video.addEventListener('ended', aoTerminarVideo);
    limparTentativa = () => {
      window.clearInterval(monitor);
      document.removeEventListener('visibilitychange', retomarMonitoramento);
      video.removeEventListener('error', tratarFalha, true);
      video.removeEventListener('ended', aoTerminarVideo);
    };

    try {
      video.muted = true;
      if (tentativaAtual === 2) {
        // load() reinicia o recurso e a posição, sem recarregar a página.
        video.load();
      } else if (video.error) {
        tratarFalha();
        return;
      } else if (video.ended) {
        aoTerminarVideo();
        return;
      }
      // A rejeição inclui bloqueios de reprodução automática.
      const reproducao = video.play();
      if (reproducao) reproducao.catch(tratarFalha);
    } catch (erro) {
      tratarFalha(erro);
    }
  }

  tentarReproduzir();
}

// ============================================================
// 3. NAVEGAÇÃO DAS PÁGINAS
// ============================================================

let navegacaoEmAndamento = false;
let navegacaoInicializada = false;

function obterUrlRota(nomeRota) {
  if (!Object.hasOwn(ROTAS, nomeRota)) {
    throw new Error(`Rota não cadastrada: ${nomeRota}`);
  }
  return validarDestino(ROTAS[nomeRota]);
}

// Use substituir apenas quando a página atual não deve ficar no histórico.
export function navegarPara(nomeRota, { substituir = false } = {}) {
  if (navegacaoEmAndamento) return false;
  try {
    const destino = obterUrlRota(nomeRota);
    navegacaoEmAndamento = true;
    limparErroNavegacao();
    if (substituir) window.location.replace(destino);
    else window.location.assign(destino);
    return true;
  } catch (erro) {
    navegacaoEmAndamento = false;
    registrarErro(erro, 'Não foi possível abrir esta página. Tente novamente ou escolha outro destino.');
    return false;
  }
}
export function iniciarNavegacao() {
  if (navegacaoInicializada) return;
  navegacaoInicializada = true;

  // Links recebem href real para teclado, menu de contexto e novas abas.
  document.querySelectorAll('a[data-rota]').forEach((link) => {
    try {
      link.href = obterUrlRota(link.dataset.rota);
    } catch (erro) {
      link.removeAttribute('href');
      registrarErro(erro, 'Um dos links desta página está indisponível. Os demais continuam funcionando.');
    }
  });

  // Delegação também atende botões adicionados à página posteriormente.
  document.addEventListener('click', (evento) => {
    const elemento = evento.target.closest?.('a[data-rota], button[data-rota]');
    if (!elemento || evento.defaultPrevented || elemento.disabled) return;
    // O formulário deve terminar de salvar os dados antes de navegar.
    if (elemento.tagName === 'BUTTON' && elemento.type === 'submit') return;
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey ||
        evento.shiftKey || evento.altKey) return;
    if (elemento.tagName === 'A' &&
        (elemento.hasAttribute('download') ||
         (elemento.target && elemento.target !== '_self'))) return;

    evento.preventDefault();
    navegarPara(elemento.dataset.rota);
  });

  // Ao voltar por cache do navegador, libera novos cliques.
  window.addEventListener('pageshow', () => {
    navegacaoEmAndamento = false;
  });

  iniciarIntroducao();
}


// ============================================================
// 4. TRATAMENTO DE ERROS
// ============================================================

// Valida configuração local; não faz requisições extras a cada navegação.
// Erros HTTP (como 404) depois da troca de documento são responsabilidade
// da hospedagem. Esta validação não garante que o arquivo exista no servidor.
function validarDestino(caminho) {
  if (typeof caminho !== 'string' || !caminho.trim() ||
      caminho !== caminho.trim() || caminho.startsWith('/') ||
      caminho.includes('\\') || /^[a-z][a-z\d+.-]*:/i.test(caminho)) {
    throw new Error('O destino deve ser um caminho relativo à raiz do projeto.');
  }
  const base = new URL(BASE_URL);
  const destino = new URL(caminho, base);
  if (destino.origin !== base.origin ||
      !destino.pathname.startsWith(base.pathname) ||
      !destino.pathname.endsWith('.html')) {
    throw new Error('O destino deve ser uma página HTML dentro do projeto.');
  }
  return destino.href;
}

function registrarErro(erro, mensagem, exibir = true) {
  console.error('[Navegação]', mensagem, erro);
  if (!exibir) return;

  let aviso = document.querySelector('#erro-navegacao');
  if (!aviso) {
    aviso = document.createElement('p');
    aviso.id = 'erro-navegacao';
    aviso.className = 'erro-navegacao';
    aviso.setAttribute('role', 'alert');
    aviso.setAttribute('aria-atomic', 'true');
    document.body.append(aviso);
  }
  aviso.hidden = false;
  aviso.textContent = mensagem;
}

function limparErroNavegacao() {
  const aviso = document.querySelector('#erro-navegacao');
  if (aviso) {
    aviso.textContent = '';
    aviso.hidden = true;
  }
}


