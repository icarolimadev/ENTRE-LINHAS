// Entrada compartilhada por todas as telas.



import { iniciarNavegacao } from './navigation/navigation.js';
import { inicializarFormulario } from '../data/storage/localstorage.js';
import { inicializarHistoria } from './historias.js';



inicializarFormulario();
iniciarNavegacao();
inicializarHistoria();

// Remove somente dados deste jogo, após confirmação da pessoa usuária.
const apagarDados = document.querySelector('[data-apagar-dados]');
apagarDados?.addEventListener('click', () => {
    if (!window.confirm('Apagar seu apelido e toda a jornada salva neste navegador? Esta ação não pode ser desfeita.')) return;
    try {
        localStorage.removeItem('entreLinhas.apelido');
        localStorage.removeItem('entreLinhas.jornada.v1');
        window.location.reload();
    } catch {
        document.querySelector('[data-privacidade-aviso]').textContent = 'Não foi possível apagar todos os dados. Tente novamente ou use as configurações do navegador.';
    }
});
