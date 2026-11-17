// Teste do link da rota. Rodar: npm run testar:calculos
import test from 'node:test';
import assert from 'node:assert/strict';
import { linkRota } from './rota.js';

test('link do Google Maps com paradas na ordem', () => {
  assert.equal(linkRota(['Rua A, 10 - Centro', 'Av. B, 20', 'Rua C, 30']),
    'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=Rua%20C%2C%2030&waypoints=Rua%20A%2C%2010%20-%20Centro%7CAv.%20B%2C%2020');
  assert.equal(linkRota(['Rua A, 10']), 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=Rua%20A%2C%2010');
  assert.equal(linkRota(['', '  ']), null);
  const muitos = Array.from({ length: 14 }, (_, i) => `Rua ${i}`);
  assert.equal(linkRota(muitos).split('%7C').length, 9);            // 9 paradas intermediárias
  assert.ok(linkRota(muitos).includes('destination=Rua%209&'));     // + o destino = 10 no total
});
