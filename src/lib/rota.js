// Rota do dia: monta o link do Google Maps com os endereços escolhidos, na ordem da lista.
// O Google Maps aceita até 10 paradas por link (9 intermediárias + o destino).
export const MAX_PARADAS = 10;

export function linkRota(enderecos) {
  const paradas = enderecos.map((e) => e.trim()).filter(Boolean).slice(0, MAX_PARADAS);
  if (paradas.length === 0) return null;
  const destino = paradas[paradas.length - 1];
  const meio = paradas.slice(0, -1);
  // Sem "origin": o Maps parte de onde a pessoa está
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destino)}`
    + (meio.length ? `&waypoints=${meio.map(encodeURIComponent).join('%7C')}` : '');
}
