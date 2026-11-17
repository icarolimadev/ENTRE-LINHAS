# ENTRE-LINHAS
Jogo educativo e de conscientização desenvolvido para o NUGEDS/IFCE. Simples na mecânica, mas impactante na mensagem.

## Interface implementada

Abra `index.html` para assistir à introdução. O link **Continuar** abre a tela de boas-vindas, que também pode ser acessada diretamente em `src/pages/boas-vindas.html`.

A tela de boas-vindas utiliza o logotipo, a ilustração e as ondas disponíveis em `assets/`. O botão **Começar** é apenas visual nesta etapa: sua ação será definida posteriormente.

## Organização dos estilos

- `src/css/main.css`: centraliza as importações.
- `src/css/global/thames.css`: cores da interface.
- `src/css/global/base.css`: regras compartilhadas e foco de teclado.
- `src/css/global/typography.css`: fontes e tamanhos; as fontes do Google dependem de conexão, com alternativa sans-serif.
- `src/css/pages/entrada.css`: vídeo e link de navegação; o bloqueio de rolagem fica restrito à introdução.
- `src/css/pages/boas-vindas.css`: layout responsivo, botão e rodapé, permitindo rolagem vertical quando necessário.

## Validação da tela de boas-vindas

Foram verificados os caminhos locais do HTML, as importações CSS e capturas no Chrome headless com janelas de 390 × 844, 320 × 568 e 844 × 390 pixels. Em telas baixas, o conteúdo continua abaixo da área inicialmente visível, com rolagem habilitada. Não houve teste em aparelho físico nem validação da reprodução do vídeo nesta alteração.

A referência foi adaptada como página web, sem simular relógio, recorte de câmera ou barra de gestos do sistema operacional.


