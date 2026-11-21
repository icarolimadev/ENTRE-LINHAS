// Independente dos módulos: também cobre erro de importação ou falha na sequência.
// Sem JavaScript, a marca estática e o link HTML continuam disponíveis.
(() => {
    const link = document.querySelector('.intro__continuar');
    if (!link) return;
    let concluida = false;
    const avancar = () => {
        if (concluida) return;
        concluida = true;
        clearTimeout(limite);
        document.dispatchEvent(new Event('intro:encerrar'));
        window.location.replace(link.href);
    };
    const limite = window.setTimeout(avancar, 11000);
    document.addEventListener('intro:avancar', avancar);
    link.addEventListener('click', (evento) => {
        if (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return;
        evento.preventDefault();
        avancar();
    });
    window.addEventListener('pagehide', () => clearTimeout(limite), { once: true });
    window.addEventListener('pageshow', (evento) => {
        if (evento.persisted) {
            concluida = false;
            avancar();
        }
    });
})();
