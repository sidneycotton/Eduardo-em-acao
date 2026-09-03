# O Corredor do Professor

Jogo infinito estilo *Subway Surfers*, feito com Three.js, em homenagem ao professor
careca de camisa azul que sente que sua vida às vezes parece exatamente isso:
correr por um corredor infinito desviando de alunos grudados no celular.

## Como jogar

Abra `index.html` em qualquer navegador moderno (não precisa de instalação nem build).

- **Setas ← / →** ou **A / D**: trocar de fileira
- **Espaço / ↑ / W**: pular
- **Toque/arraste** (celular): deslizar para os lados troca de fileira, toque/deslize
  para cima pula
- Colete as **moedas azuis** flutuantes para ganhar metros extras
- A velocidade aumenta com a distância percorrida — sobreviva o máximo possível!

## Rodando localmente

Basta abrir `index.html` direto no navegador. Se preferir servir por HTTP local:

```bash
cd jogo-professor
python3 -m http.server 8080
# depois acesse http://localhost:8080
```

## Estrutura

- `index.html` — estrutura da página, HUD e telas de início/game over
- `game.js` — toda a lógica do jogo em Three.js (cenário, personagem, obstáculos,
  física de pulo, colisões, pontuação, sons simples via WebAudio)

## Estilo visual

Corredor escolar estilizado em tons de azul neon, no mesmo espírito visual do
"Hero Vortex": fog azulado, luzes neon nas paredes tipo armários, e um personagem
low-poly careca de camisa azul e gravata correndo por três fileiras, pulando os
alunos que aparecem olhando para o celular.
