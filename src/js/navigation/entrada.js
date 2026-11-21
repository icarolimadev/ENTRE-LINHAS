import { iniciarIntroducao } from './introducao.js';

// O controlador clássico dispara este evento dentro do clique, preservando
// a ativação do usuário para iniciar o áudio sem troca de documento.
document.addEventListener('intro:iniciar', () => {
    iniciarIntroducao(document.querySelector('.intro'));
}, { once: true });
