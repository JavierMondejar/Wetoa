#!/usr/bin/env node
// Consulta servicios cercanos desde OpenStreetMap (Overpass API)

import { readJSON, writeJSON, parseArgs, download, sleep, campo } from './utils.mjs';
import fs from 'fs';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'WelcomeToAlicante/1.0 (contact@welcometoalicante.info)';
const ENABLE_OSM = process.env.ENABLE_OSM !== 'false';

/**
 * Consulta Overpass API
 */
async function queryOverpass(query) {
  if (!ENABLE_OSM) {
    console.log('  [SKIP] OSM deshabilitado (ENABLE_OSM=false)');
    return { elements: [] };
  }

  try {
    const response = await download(
      `${OVERPASS_URL}?data=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': USER_AGENT } }
    );
    
    await sleep(1000); // Respetar 1 req/s
    
    return JSON.parse(response);
  } catch (error) {
    console.error(`  [ERROR] Overpass: ${error.message}`);
    return { elements: [] };
  }
}

/**
 * Busca servicios cerca de una playa
 */
async function buscarServiciosCercanos(playa, lat, lng) {
  console.log(`\n[${playa.slug}] Buscando servicios OSM cerca de ${lat}, ${lng}`);
  
  if (!lat || !lng) {
    console.log('  ❌ Sin coordenadas, omitiendo');
    return null;
  }
  
  const radio = 500; // metros
  
  // Query Overpass para servicios relevantes
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="parking"](around:${radio},${lat},${lng});
      node["amenity"="toilets"](around:${radio},${lat},${lng});
      node["leisure"="beach_resort"](around:${radio},${lat},${lng});
      node["tourism"="information"](around:${radio},${lat},${lng});
      node["highway"="bus_stop"](around:${radio},${lat},${lng});
    );
    out body;
  `;
  
  const data = await queryOverpass(query);
  
  // Procesar resultados
  const parkings = data.elements.filter(e => e.tags?.amenity === 'parking');
  const toilets = data.elements.filter(e => e.tags?.amenity === 'toilets');
  const busStops = data.elements.filter(e => e.tags?.highway === 'bus_stop');
  
  console.log(`  ✓ Encontrados: ${parkings.length} parkings, ${toilets.length} aseos, ${busStops.length} paradas`);
  
  return {
    parkings: parkings.map(p => ({
      nombre: p.tags.name || 'Parking',
      tipo: p.tags.parking || 'desconocido',
      capacidad: p.tags.capacity ? parseInt(p.tags.capacity) : null,
      tarifa: p.tags.fee === 'yes',
      lat: p.lat,
      lon: p.lon
    })),
    aseos: toilets.map(t => ({
      nombre: t.tags.name || 'Aseos',
      adaptado: t.tags.wheelchair === 'yes',
      lat: t.lat,
      lon: t.lon
    })),
    paradas_bus: busStops.map(b => ({
      nombre: b.tags.name || 'Parada',
      lat: b.lat,
      lon: b.lon
    }))
  };
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
      servicios: campo(null, null, null, null)
    };
  }
  
  const servicios = await buscarServiciosCercanos(
    playa,
    coords.lat.valor,
    coords.lng.valor
  );
  
  if (!servicios) {
    return {
      slug: playa.slug,
      nombre: playa.nombre,
      servicios: campo(null, null, null, null)
    };
  }
  
  const fuente = 'OpenStreetMap via Overpass API';
  const url = `https://www.openstreetmap.org/?mlat=${coords.lat.valor}&mlon=${coords.lng.valor}&zoom=16`;
  
  return {
    slug: playa.slug,
    nombre: playa.nombre,
    servicios: campo(servicios, fuente, url, 'api', 'media')
  };
}

/**
 * Main
 */
async function main() {
  const args = parseArgs(process.argv);
  const input = args.in || 'data/beaches-master.json';
  const output = args.out || 'data/sources/osm-servicios.json';
  const only = args.only ? args.only.split(',') : null;
  
  console.log('=== Script: Servicios OSM ===');
  console.log(`Input: ${input}`);
  console.log(`Output: ${output}`);
  console.log(`OSM: ${ENABLE_OSM ? 'habilitado' : 'deshabilitado'}`);
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
  
  const exito = results.filter(r => r.servicios.valor !== null).length;
  console.log(`\nResumen: ${exito}/${results.length} playas con servicios encontrados`);
}

main().catch(console.error);
