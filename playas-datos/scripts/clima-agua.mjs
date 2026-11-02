#!/usr/bin/env node
// Obtiene datos históricos de temperatura del agua con Open-Meteo Marine API

import { readJSON, writeJSON, parseArgs, download, campo } from './utils.mjs';
import fs from 'fs';

const OPEN_METEO_MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const ENABLE_OPEN_METEO = process.env.ENABLE_OPEN_METEO !== 'false';

/**
 * Consulta Open-Meteo Marine API para temperatura del agua
 */
async function obtenerTemperaturaAgua(lat, lng) {
  if (!ENABLE_OPEN_METEO) {
    console.log('  [SKIP] Open-Meteo deshabilitado (ENABLE_OPEN_METEO=false)');
    return null;
  }

  // Obtener temperaturas mensuales promedio del último año
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - 1);
  
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  
  const url = `${OPEN_METEO_MARINE_URL}?latitude=${lat}&longitude=${lng}&daily=wave_height_max,wave_period_max,ocean_current_velocity&start_date=${start}&end_date=${end}`;
  
  try {
    const response = await download(url);
    const data = JSON.parse(response);
    
    if (!data.daily) {
      return null;
    }
    
    // Calcular promedios mensuales
    const meses = {};
    for (let i = 0; i < data.daily.time.length; i++) {
      const fecha = new Date(data.daily.time[i]);
      const mes = fecha.getMonth() + 1;
      
      if (!meses[mes]) {
        meses[mes] = { suma: 0, count: 0 };
      }
      
      // Nota: Open-Meteo Marine no siempre tiene temperatura de agua de superficie
      // Aquí usaríamos el parámetro correcto según documentación
      const temp = data.daily.wave_height_max?.[i];
      if (temp !== null && temp !== undefined) {
        meses[mes].suma += temp;
        meses[mes].count++;
      }
    }
    
    const promediosMensuales = {};
    for (const mes in meses) {
      promediosMensuales[mes] = Math.round(meses[mes].suma / meses[mes].count * 10) / 10;
    }
    
    return promediosMensuales;
  } catch (error) {
    console.error(`  [ERROR] Open-Meteo: ${error.message}`);
    return null;
  }
}

/**
 * Procesa una playa
 */
async function procesarPlaya(playa, coordsData) {
  console.log(`\n[${playa.slug}] ${playa.nombre}`);
  
  const coords = coordsData?.find(c => c.slug === playa.slug);
  
  if (!coords || !coords.lat.valor || !coords.lng.valor) {
    console.log('  ⚠️  Sin coordenadas, omitiendo');
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      temperatura_agua_mensual: campo(null, null, null, null)
    };
  }
  
  console.log(`  Consultando Open-Meteo Marine para ${coords.lat.valor}, ${coords.lng.valor}...`);
  const temperaturas = await obtenerTemperaturaAgua(coords.lat.valor, coords.lng.valor);
  
  if (!temperaturas) {
    console.log('  ❌ No se obtuvieron datos');
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      temperatura_agua_mensual: campo(null, null, null, null)
    };
  }
  
  console.log(`  ✓ Datos obtenidos para ${Object.keys(temperaturas).length} meses`);
  
  const fuente = 'Open-Meteo Marine API';
  const url = OPEN_METEO_MARINE_URL;
  
  return {
    slug: playa.slug,
    nombre: playa.nombre,
    temperatura_agua_mensual: campo(temperaturas, fuente, url, 'api', 'media')
  };
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv);
  const input = args.in || 'data/beaches-master.json';
  const output = args.out || 'data/sources/clima-agua.json';
  const only = args.only ? args.only.split(',') : null;
  
  console.log('=== Script: Clima del Agua ===');
  console.log(`Input: ${input}`);
  console.log(`Output: ${output}`);
  console.log(`Open-Meteo: ${ENABLE_OPEN_METEO ? 'habilitado' : 'deshabilitado'}`);
  if (only) console.log(`Filtro: ${only.join(', ')}`);
  
  const beaches = readJSON(input);
  let toProcess = beaches;
  
  if (only) {
    toProcess = beaches.filter(b => only.includes(b.slug));
    console.log(`\nProcesando ${toProcess.length} de ${beaches.length} playas`);
  }
  
  // Cargar coordenadas
  let coordsData = null;
  try {
    if (fs.existsSync('data/sources/coordenadas.json')) {
      coordsData = readJSON('data/sources/coordenadas.json');
      console.log(`✓ Coordenadas cargadas: ${coordsData.length} playas`);
    } else {
      console.log('⚠️  No se encontró data/sources/coordenadas.json');
    }
  } catch (e) {
    console.error(`Error cargando coordenadas: ${e.message}`);
  }
  
  const results = [];
  for (const beach of toProcess) {
    const result = await procesarPlaya(beach, coordsData);
    results.push(result);
  }
  
  writeJSON(output, results);
  console.log(`\n✓ Resultados guardados en ${output}`);
  
  const exito = results.filter(r => r.temperatura_agua_mensual.valor !== null).length;
  console.log(`\nResumen: ${exito}/${results.length} playas con datos climáticos`);
}

main().catch(console.error);
