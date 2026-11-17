
## Tela de entrada - 17/11

- `index.html`: estrutura da entrada e vídeo com `autoplay`, `muted` e `playsinline`, sem repetição.
- `src/css/main.css`: folha principal que importa os estilos da entrada.
- `src/css/pages/entrada.css`: fundo preto, área visível sem rolagem e vídeo centralizado com `object-fit: contain`, preservando a imagem inteira.
- `assets/videos/intro-celular.mp4`: vídeo atualmente utilizado, com dimensões de 1080 × 2340 pixels.

A altura usa `100dvh` para acompanhar a área visível no celular, com `100vh` como alternativa. Quando a proporção da tela difere da proporção do vídeo, sobra espaço preto nas laterais ou acima e abaixo.

## Validação da etapa 5 — 17/11/2026

Foram conferidos os caminhos locais do HTML, a importação CSS, a existência do vídeo e os atributos de reprodução. As dimensões foram extraídas dos metadados do MP4.

Os valores abaixo são cálculos de encaixe com `contain`, não medições em navegador:

| Área visível (px) | Imagem do vídeo (px, aproximados) | Recorte |
| --- | --- | --- |
| 320 × 568 | 262,2 × 568 | Nenhum |
| 390 × 844 | 389,5 × 844 | Nenhum |
| 412 × 915 | 412 × 892,7 | Nenhum |
| 844 × 390 | 180 × 390 | Nenhum |
| 1366 × 768 | 354,5 × 768 | Nenhum |

O teste no Chrome headless não pôde ser executado: o ambiente bloqueou uma operação de socket (`setsockopt: Operation not permitted`). A reprodução, o último quadro e a resposta às barras móveis do navegador ainda precisam de validação visual.

### Conferência manual

1. Abra `index.html` em um navegador e confira se o vídeo inicia sem som.
2. Confira os tamanhos acima no modo responsivo das ferramentas de desenvolvimento.
3. Em um celular, confira as orientações vertical e horizontal, a ausência de rolagem e a imagem inteira sobre fundo preto.
4. Aguarde o término: o vídeo deve parar no último quadro, sem reiniciar.

O navegador pode bloquear a reprodução automática conforme suas políticas ou configurações. O link alternativo do HTML atende navegadores sem suporte ao elemento `video`; ele não resolve bloqueios de autoplay.

