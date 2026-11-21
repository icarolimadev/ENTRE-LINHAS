// Controlador independente: mantém a saída disponível se o módulo falhar.
// Sem JavaScript, Entrar é um link nativo para as boas-vindas.
(() => {
    const tela = document.querySelector('.abertura');
    const intro = document.querySelector('.intro');
    const entrar = document.querySelector('.abertura__botao');
    const pular = document.querySelector('.intro__continuar');
    if (!tela || !intro || !entrar || !pular) return;
    let iniciada = false;
    let concluida = false;
    let limite;
    const cliquePrincipal = (evento) => evento.button === 0 &&
        !evento.ctrlKey && !evento.metaKey && !evento.shiftKey && !evento.altKey;
    const avancar = () => {
        if (concluida) return;
        concluida = true;
        clearTimeout(limite);
        document.dispatchEvent(new Event('intro:encerrar'));
        window.location.replace(pular.href);
    };
    entrar.addEventListener('click', (evento) => {
        if (!cliquePrincipal(evento)) return;
        evento.preventDefault();
        if (iniciada) return;
        iniciada = true;
        tela.hidden = true;
        intro.hidden = false;
        document.body.classList.add('pagina-abertura--animando');
        pular.focus({ preventScroll: true });
        // O prazo começa no clique, nunca enquanto a pessoa lê a abertura.
        limite = window.setTimeout(avancar, 11000);
        document.dispatchEvent(new Event('intro:iniciar'));
    });
    document.addEventListener('intro:avancar', avancar);
    pular.addEventListener('click', (evento) => {
        if (!cliquePrincipal(evento)) return;
        evento.preventDefault();
        avancar();
    });
    window.addEventListener('pagehide', () => clearTimeout(limite));
    window.addEventListener('pageshow', (evento) => {
        if (evento.persisted && iniciada) {
            concluida = false;
            avancar();
        }
    });
})();
