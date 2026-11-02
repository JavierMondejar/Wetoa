#!/usr/bin/env node
// Extrae el listado de Banderas Azules 2026 para Alicante desde ADEAC

import { readJSON, writeJSON, parseArgs, download, downloadBinary, normalizarNombrePlaya, campo } from './utils.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse: pdf } = require('pdf-parse');

// URL del PDF oficial de ADEAC 2026
const BANDERA_AZUL_URL = 'https://www.banderaazul.org';
const PDF_2026_URL = 'https://www.banderaazul.org/sites/default/files/2026/Rueda-de-prensa-2026/Relación%20Playas%20Galardonadas%202026.pdf';

/**
 * Descarga el PDF oficial de Banderas Azules 2026 de ADEAC
 * NOTA 2026: El PDF oficial existe pero el parser ESM de pdf-parse tiene problemas de compatibilidad.
 * La lista completa está disponible en el PDF; por ahora se marca como "por confirmar".
 * Alternativa: parsear manualmente el PDF descargado o usar herramienta externa (pdftotext).
 */
async function descargarBanderasAzules() {
  console.log('\nDescargando listado de Banderas Azules 2026...');
  console.log(`  Fuente: ${PDF_2026_URL}`);
  console.log('  ⚠️  Parser PDF no disponible en este entorno ESM.');
  console.log('  El PDF oficial existe y puede descargarse manualmente.');
  console.log('  Se requiere implementar parser alternativo o usar pdftotext CLI.');
  console.log('  Por ahora, este campo se marca como "por confirmar".');
  
  return [];
}

/**
 * Extrae playas de Alicante del texto del PDF oficial de ADEAC
 */
function extraerPlayasPDF(text) {
  const playas = [];
  
  // Buscar sección de Alicante en el PDF
  const alicanteSectionMatch = text.match(/ALICANTE[\s\S]*?(?=ALMERÍA|ASTURIAS|BARCELONA|$)/i);
  if (!alicanteSectionMatch) {
    console.log('  [WARN] No se encontró sección de Alicante en el PDF');
    return [];
  }
  
  const alicateSection = alicanteSectionMatch[0];
  
  // Dividir en líneas y buscar nombres de playas
  const lines = alicateSection.split('\n');
  let currentMunicipio = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detectar línea de municipio (en mayúsculas, sin números al inicio)
    if (trimmed.match(/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s']+$/) && trimmed.length > 3 && trimmed.length < 50) {
      currentMunicipio = trimmed;
      continue;
    }
    
    // Detectar línea de playa (empieza con número o guión, contiene texto)
    const playaMatch = trimmed.match(/^[\d\-\•\*\s]*(.+)$/);
    if (playaMatch) {
      let nombre = playaMatch[1].trim();
      
      // Filtrar líneas que claramente son nombres de playa
      if ((nombre.match(/playa|platja|cala|beach/i) || (currentMunicipio && nombre.length > 3)) && 
          nombre.length < 100 &&
          !nombre.match(/^(municipio|provincia|total|página)/i)) {
        
        playas.push({
          nombre,
          municipio: currentMunicipio,
          year: 2026
        });
      }
    }
  }
  
  return playas;
}

/**
 * Limpia nombre bilingüe (toma solo parte española antes de " · ")
 */
function limpiarNombreBiligue(nombre) {
  if (nombre.includes(' · ')) {
    return nombre.split(' · ')[0].trim();
  }
  return nombre;
}

/**
 * Busca si una playa tiene Bandera Azul
 */
function tieneBanderaAzul(playa, listado) {
  if (!listado || listado.length === 0) {
    return null;
  }
  
  const nombreLimpio = limpiarNombreBiligue(playa.nombre);
  const nombreNorm = normalizarNombrePlaya(nombreLimpio);
  const municipioNorm = playa.municipio.toLowerCase();
  
  const match = listado.find(b => {
    const bNombreLimpio = limpiarNombreBiligue(b.nombre || '');
    const bNombre = normalizarNombrePlaya(bNombreLimpio);
    const bMunicipio = (b.municipio || '').toLowerCase();
    
    // Match por nombre y municipio
    if (bMunicipio === municipioNorm && bNombre === nombreNorm) {
      return true;
    }
    
    // Match solo por nombre si municipio no está disponible
    if (!b.municipio && bNombre === nombreNorm) {
      return true;
    }
    
    return false;
  });
  
  return match ? match.year : false;
}

/**
 * Procesa una playa
 */
function procesarPlaya(playa, listado) {
  console.log(`\n[${playa.slug}] ${playa.nombre} (${playa.municipio})`);
  
  const result = tieneBanderaAzul(playa, listado);
  
  if (result === null) {
    console.log('  ⚠️  No se pudo verificar (listado no disponible)');
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      municipio: playa.municipio,
      bandera_azul_2026: campo(null, null, null, null)
    };
  }
  
  const tiene = result !== false;
  const year = result || 2026;
  
  console.log(`  ${tiene ? '✓' : '✗'} Bandera Azul ${year}: ${tiene ? 'SÍ' : 'NO'}`);
  
  const fuente = `Valencia Bonita (prensa) - Bandera Azul ${year}`;
  const url = VALENCIA_BONITA_2026_URL;
  
  return {
    slug: playa.slug,
    nombre: playa.nombre,
    municipio: playa.municipio,
    bandera_azul_2026: campo(tiene, fuente, url, 'dataset', 'media') // Confianza media (fuente periodística)
  };
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv);
  const input = args.in || 'data/beaches-master.json';
  const output = args.out || 'data/sources/bandera-azul.json';
  const only = args.only ? args.only.split(',') : null;
  
  console.log('=== Script: Bandera Azul ===');
  console.log(`Input: ${input}`);
  console.log(`Output: ${output}`);
  if (only) console.log(`Filtro: ${only.join(', ')}`);
  
  const beaches = readJSON(input);
  let toProcess = beaches;
  
  if (only) {
    toProcess = beaches.filter(b => only.includes(b.slug));
    console.log(`\nProcesando ${toProcess.length} de ${beaches.length} playas`);
  }
  
  // Descargar listado
  const listado = await descargarBanderasAzules();
  
  const results = [];
  for (const beach of toProcess) {
    const result = procesarPlaya(beach, listado);
    results.push(result);
  }
  
  writeJSON(output, results);
  console.log(`\n✓ Resultados guardados en ${output}`);
  
  const conBandera = results.filter(r => r.bandera_azul_2026.valor === true).length;
  const verificados = results.filter(r => r.bandera_azul_2026.valor !== null).length;
  console.log(`\nResumen: ${conBandera} con Bandera Azul, ${verificados}/${results.length} verificadas`);
}

main().catch(console.error);
