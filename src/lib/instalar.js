// Instalação do app no celular (PWA): descobre o aparelho e guarda o
// "convite de instalação" que o Chrome do Android oferece.

// Já está instalado/aberto como aplicativo?
export const instalado = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// 'iphone' | 'android' | 'computador'
export function plataforma(ua = navigator.userAgent) {
  // iPad novo se apresenta como Mac, mas tem tela de toque
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone';
  if (/android/i.test(ua)) return 'android';
  return 'computador';
}

// No iPhone: está no Safari? (Chrome, Firefox etc. no iPhone têm o botão em outro lugar)
export const safariNoIphone = (ua = navigator.userAgent) => !/crios|fxios|edgios|opios/i.test(ua);

// Aberto dentro de outro aplicativo (Instagram, Facebook...): ali não dá para instalar
export const dentroDeOutroApp = (ua = navigator.userAgent) => /instagram|fban|fbav|fb_iab|line\/|; wv\)/i.test(ua);

// ---------- Convite de instalação do Android ----------
let convite = null;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach((fn) => fn());

// O Chrome dispara este evento quando o app pode ser instalado; guardamos para usar no botão
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); convite = e; avisar(); });
window.addEventListener('appinstalled', () => { convite = null; avisar(); });

export const temConvite = () => Boolean(convite);
export function aoMudarConvite(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }

// Abre a janela "Instalar app" do Android. Devolve true se a pessoa aceitou.
export async function instalarAgora() {
  if (!convite) return false;
  convite.prompt();
  const { outcome } = await convite.userChoice;
  convite = null; avisar();
  return outcome === 'accepted';
}
