// Assinatura com o dedo na tela. Devolve a imagem (PNG) por onChange, ou null quando está em branco.
import { useEffect, useRef, useState } from 'react';

export default function Assinatura({ onChange }) {
  const tela = useRef(null);
  const desenhando = useRef(false);
  const [temTraco, setTemTraco] = useState(false);

  // Prepara o quadro: fundo branco e tamanho real em pixels (fica nítido em tela de celular)
  function preparar() {
    const c = tela.current, escala = window.devicePixelRatio || 1;
    c.width = c.clientWidth * escala; c.height = c.clientHeight * escala;
    const ctx = c.getContext('2d');
    ctx.scale(escala, escala);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f172a';
  }
  useEffect(preparar, []);

  const ponto = (e) => { const r = tela.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  function comecar(e) {
    e.preventDefault();
    tela.current.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const ctx = tela.current.getContext('2d'), [x, y] = ponto(e);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke(); // um toque já deixa um ponto
  }
  function mover(e) {
    if (!desenhando.current) return;
    const ctx = tela.current.getContext('2d'), [x, y] = ponto(e);
    ctx.lineTo(x, y); ctx.stroke();
  }
  function terminar() {
    if (!desenhando.current) return;
    desenhando.current = false;
    setTemTraco(true);
    tela.current.toBlob((blob) => onChange(blob), 'image/png');
  }
  function limpar() { preparar(); setTemTraco(false); onChange(null); }

  return (
    <div>
      <canvas ref={tela} onPointerDown={comecar} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar}
        aria-label="Área para assinar com o dedo"
        className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white" />
      <div className="flex items-center justify-between pt-1 text-sm">
        <span className="text-slate-500">{temTraco ? 'Assinatura registrada.' : 'Assine com o dedo dentro do quadro.'}</span>
        {temTraco && <button type="button" onClick={limpar} className="font-medium text-red-700 underline">Limpar</button>}
      </div>
    </div>
  );
}
