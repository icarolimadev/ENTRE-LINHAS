import { navegarPara } from '../../js/navigation/navigation.js';

const chave = 'entreLinhas.apelido';
const campoNome = document.querySelector('#nome');
const formulario = campoNome?.form;
const aviso = document.querySelector('#aviso-prototipo');
const tituloInicio = document.querySelector('#titulo-inicio');

// Recupera o nome sem sobrescrever o que já está salvo.
let apelidoSalvo = '';
try {
  apelidoSalvo = localStorage.getItem(chave) || '';
} catch {
  if (aviso) aviso.textContent = 'O armazenamento está indisponível neste navegador.';
}

if (campoNome) campoNome.value = apelidoSalvo;

// textContent exibe o nome como texto, sem interpretar HTML.
if (tituloInicio) {
  tituloInicio.textContent = `Olá, ${apelidoSalvo || 'visitante'}!`;
}

if (formulario) {
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const apelido = campoNome.value.trim();

    try {
      if (apelido) {
        localStorage.setItem(chave, apelido);
      } else {
        // Entrar como visitante remove somente o nome salvo anteriormente.
        localStorage.removeItem(chave);
      }
    } catch {
      aviso.textContent = 'Não foi possível salvar o nome. Verifique se o armazenamento está permitido e tente novamente.';
      return;
    }

    navegarPara('inicio');
  });
}
