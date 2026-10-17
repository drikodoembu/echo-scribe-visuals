# Correção mínima: congelamento do movimento das imagens na montagem

Escopo: somente `src/routes/_authenticated/app.montagem.tsx`, no laço que renderiza cada cena (linhas ~240-281). Nada mais é alterado.

## Alterações

1. **Entrada com uma única imagem**: remover `"-loop", "1", "-framerate", String(fps)` dos argumentos do `ffmpeg.exec` da cena. Fica `-i imgN.jpg`.
2. **zoompan gera exatamente `perFrames` quadros a 30 FPS**: manter `d=${perFrames}:s=${w}x${h}:fps=${fps}`.
3. **Remover o `trim`**: o filtro passa a terminar em `setpts=PTS-STARTPTS,setsar=1,format=yuv420p`. A duração continua controlada por `-frames:v perFrames` (já existente).
4. **Progresso com `perFrames - 1`**: `const den = Math.max(1, perFrames - 1)` e todas as expressões usam `on/${den}`, para que o último quadro chegue a 100%.
5. **Zoom-in (cenas pares)**: `z = 1+0.25*on/den`; o deslocamento direcional atual (esquerda/direita/cima/baixo) é mantido, pois a amplitude cresce com o zoom e o movimento não para.
6. **Zoom-out (cenas ímpares)**: `z = 1.25-0.25*on/den`, **centralizado e sem deslocamento**: `x=(iw-iw/zoom)/2`, `y=(ih-ih/zoom)/2`. Isso elimina a desaceleração até parar no fim da cena.

## Não alterado

Escala de 1,5×, codecs, preset/CRF, resolução final, concatenação, áudio/música, Storage, autenticação, imagens, roteiros, SEO. Sem smoothstep.

## Validação

1. Checagem de TypeScript e build.
2. Teste real de renderização com FFmpeg nativo no ambiente, usando exatamente os mesmos argumentos/filtros gerados (9:16 e 16:9, cenas curtas e longas, zoom-in e zoom-out):
   - `ffprobe`: contagem de quadros por segmento = `perFrames`; duração = `perFrames/30`.
   - `mpdecimate`: nenhum quadro estático dentro das cenas (inclusive no fim das cenas com zoom-out).
   - Concatenação dos segmentos de teste com `-c copy` e verificação de timestamps contínuos.
3. A exportação completa no navegador (FFmpeg.wasm com narração e música) depende de interação real; se não for possível executá-la aqui, ficará informado como teste pendente para você confirmar no app.

Ao final: trechos alterados, resultados dos testes e riscos.
