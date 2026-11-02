#!/usr/bin/env node
// Calcula las 3 playas más cercanas a cada playa usando distancia haversine

import { readJSON, writeJSON, parseArgs, haversine, campo } from './utils.mjs';
import fs from 'fs';

/**
 * Encuentra las N playas más cercanas
 */
function encontrarCercanas(playa, todasPlayas, coordsData, n = 3) {
  const coords = coordsData?.find(c => c.slug === playa.slug);
  
  if (!coords || !coords.lat.valor || !coords.lng.valor) {
    return null;
  }
  
  const lat = coords.lat.valor;
  const lng = coords.lng.valor;
  
  // Calcular distancias a todas las demás playas
  const distancias = todasPlayas
    .filter(p => p.slug !== playa.slug) // Excluir la propia playa
    .map(p => {
      const pCoords = coordsData?.find(c => c.slug === p.slug);
      if (!pCoords || !pCoords.lat.valor || !pCoords.lng.valor) {
        return null;
      }
      
      const distancia = haversine(lat, lng, pCoords.lat.valor, pCoords.lng.valor);
      
      return {
        slug: p.slug,
        nombre: p.nombre,
        municipio: p.municipio,
        distancia_km: Math.round(distancia * 100) / 100,
        lat: pCoords.lat.valor,
        lng: pCoords.lng.valor
      };
    })
    .filter(d => d !== null)
    .sort((a, b) => a.distancia_km - b.distancia_km)
    .slice(0, n);
  
  return distancias;
}

/**
 * Procesa una playa
 */
function procesarPlaya(playa, todasPlayas, coordsData) {
  console.log(`\n[${playa.slug}] ${playa.nombre}`);
  
  const cercanas = encontrarCercanas(playa, todasPlayas, coordsData);
  
  if (!cercanas || cercanas.length === 0) {
    console.log('  ⚠️  Sin coordenadas o sin playas cercanas');
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      playas_cercanas: campo(null, null, null, null)
    };
  }
  
  console.log(`  ✓ ${cercanas.length} playas cercanas:`);
  cercanas.forEach(c => {
    console.log(`    - ${c.nombre} (${c.distancia_km} km)`);
  });
  
  const fuente = 'Cálculo haversine';
  
  return {
    slug: playa.slug,
    nombre: playa.nombre,
    playas_cercanas: campo(cercanas, fuente, null, 'calculo')
  };
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv);
  const input = args.in || 'data/beaches-master.json';
  const output = args.out || 'data/sources/cercanas.json';
  const only = args.only ? args.only.split(',') : null;
  
  console.log('=== Script: Playas Cercanas ===');
  console.log(`Input: ${input}`);
  console.log(`Output: ${output}`);
  if (only) console.log(`Filtro: ${only.join(', ')}`);
  
  const beaches = readJSON(input);
  
  // Cargar coordenadas
  let coordsData = null;
  try {
    if (fs.existsSync('data/sources/coordenadas.json')) {
      coordsData = readJSON('data/sources/coordenadas.json');
      console.log(`✓ Coordenadas cargadas: ${coordsData.length} playas`);
    } else {
      console.log('⚠️  No se encontró data/sources/coordenadas.json');
      process.exit(1);
    }
  } catch (e) {
    console.error(`Error cargando coordenadas: ${e.message}`);
    process.exit(1);
  }
  
  let toProcess = beaches;
  if (only) {
    toProcess = beaches.filter(b => only.includes(b.slug));
    console.log(`\nProcesando ${toProcess.length} de ${beaches.length} playas`);
  }
  
  const results = [];
  for (const beach of toProcess) {
    const result = procesarPlaya(beach, beaches, coordsData);
    results.push(result);
  }
  
  writeJSON(output, results);
  console.log(`\n✓ Resultados guardados en ${output}`);
  
  const exito = results.filter(r => r.playas_cercanas.valor !== null).length;
  console.log(`\nResumen: ${exito}/${results.length} playas con cercanas calculadas`);
}

main().catch(console.error);
