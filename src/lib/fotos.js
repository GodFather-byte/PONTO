// Fotos (contador, comprovante): reduzir antes de enviar e guardar no Supabase Storage
import { supabase } from './supabase.js';

// Reduz a foto antes de guardar (economiza internet e espaço)
export async function reduzirFoto(arquivo, lado = 1280) {
  const img = await createImageBitmap(arquivo);
  const escala = Math.min(1, lado / Math.max(img.width, img.height));
  const tela = document.createElement('canvas');
  tela.width = Math.round(img.width * escala);
  tela.height = Math.round(img.height * escala);
  tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height);
  return new Promise((ok) => tela.toBlob(ok, 'image/jpeg', 0.7));
}

// Envia uma foto para o bucket privado. O caminho começa pelo ponto (é assim que o acesso é liberado).
export async function enviarFoto(caminho, blob) {
  const { error } = await supabase.storage.from('contadores').upload(caminho, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return caminho;
}
