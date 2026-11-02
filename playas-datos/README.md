# Pipeline de Datos para Playas de Alicante

Pipeline automatizado para recopilar, procesar y enriquecer datos de playas de la provincia de Alicante para el sitio web Welcome to Alicante.

## 📋 Descripción

Este pipeline combina múltiples fuentes de datos oficiales y públicas para generar fichas completas de playas, incluyendo:

- **Coordenadas geográficas** (Nominatim OSM)
- **Características físicas** (Guía de Playas de España - MITECO)
- **Calidad del agua** (European Environment Agency)
- **Bandera Azul 2026** (ADEAC)
- **Servicios cercanos** (OpenStreetMap)
- **Temperatura del agua** (Open-Meteo Marine)
- **Playas cercanas** (cálculo haversine)

## 🏗️ Arquitectura

### Estructura de carpetas

```
playas-datos/
├── data/
│   ├── beaches-master.json      # Listado maestro de playas
│   ├── sources/                 # Datos crudos por fuente
│   │   ├── coordenadas.json
│   │   ├── guia-playas.json
│   │   ├── censo-aguas-bano.json
│   │   ├── calidad-agua.json
│   │   ├── bandera-azul.json
│   │   ├── osm-servicios.json
│   │   ├── clima-agua.json
│   │   └── cercanas.json
│   ├── fichas/                  # Fichas finales por playa
│   │   ├── playa-de-san-juan.json
│   │   └── ...
│   ├── informe-completitud.json # Análisis de completitud
│   ├── informe-completitud.md
│   └── cruce-dudoso.json        # Cruces ambiguos (si hay)
├── scripts/
│   ├── utils.mjs                # Utilidades comunes
│   ├── coordenadas.mjs
│   ├── guia-playas.mjs
│   ├── censo-aguas-bano.mjs
│   ├── calidad-agua.mjs
│   ├── bandera-azul.mjs
│   ├── osm-servicios.mjs
│   ├── clima-agua.mjs
│   ├── cercanas.mjs
│   └── montar-fichas.mjs
└── package.json
```

### Proveniencia de datos

**Cada campo incluye su proveniencia completa:**

```json
{
  "valor": "...",
  "fuente": "Nombre de la fuente",
  "url": "URL de origen",
  "fecha": "YYYY-MM-DD",
  "metodo": "dataset|api|calculo",
  "confianza": "alta|media|baja"
}
```

**Campos sin datos:**

```json
{
  "valor": null,
  "estado": "por confirmar"
}
```

## 🚀 Uso

### Instalación

No se requieren dependencias externas. El pipeline usa solo módulos nativos de Node.js.

```bash
cd playas-datos
```

### Ejecutar pipeline piloto

Procesa las 5 playas piloto:

```bash
npm run pilot
```

### Ejecutar scripts individuales

Cada script sigue el mismo patrón CLI:

```bash
node scripts/{script}.mjs --in data/beaches-master.json --out data/sources/{output}.json [--only slug1,slug2,...]
```

**Ejemplos:**

```bash
# Obtener coordenadas de todas las playas
node scripts/coordenadas.mjs --in data/beaches-master.json --out data/sources/coordenadas.json

# Procesar solo 2 playas específicas
node scripts/guia-playas.mjs --in data/beaches-master.json --out data/sources/guia-playas.json --only playa-de-san-juan,playa-del-postiguet

# Montar fichas finales
node scripts/montar-fichas.mjs --in data/beaches-master.json
```

### Variables de entorno

**Deshabilitar módulos opcionales:**

```bash
# Deshabilitar Nominatim (OSM)
ENABLE_NOMINATIM=false node scripts/coordenadas.mjs ...

# Deshabilitar consultas OSM Overpass
ENABLE_OSM=false node scripts/osm-servicios.mjs ...

# Deshabilitar Open-Meteo
ENABLE_OPEN_METEO=false node scripts/clima-agua.mjs ...
```

## 📚 Fuentes de Datos

### 1. Coordenadas (`coordenadas.mjs`)

- **Fuente principal:** [Nominatim OSM](https://nominatim.openstreetmap.org/)
- **Método:** API de geocodificación
- **Política de uso:** 1 solicitud/segundo, User-Agent personalizado
- **Fallback:** Datasets oficiales (Guía de Playas, Censo Aguas de Baño)

### 2. Guía de Playas (`guia-playas.mjs`)

- **Fuente:** [Guía de Playas de España (MITECO)](https://datos.gob.es/en/catalogo/e0dat0002-guia-de-playas-de-espana)
- **Campos:** longitud, anchura, tipo de arena, ocupación, urbanización, paseo marítimo, nudismo, accesibilidad
- **Estado:** ⚠️ Requiere verificación manual de URL de descarga directa y formato actual

### 3. Censo de Aguas de Baño (`censo-aguas-bano.mjs`)

- **Fuente:** [Censo de Zonas de Aguas de Baño (MITECO)](https://www.miteco.gob.es/fr/cartografia-y-sig/ide/descargas/agua/censo-aguas-bano.html)
- **Formatos disponibles:** SHP, GML, KMZ, GeoPackage
- **Estado:** ⚠️ Requiere descarga manual y conversión a GeoJSON (herramienta sugerida: `ogr2ogr`)

### 4. Calidad del Agua (`calidad-agua.mjs`)

- **Fuente:** [European Environment Agency - Bathing Water Quality](https://www.eea.europa.eu/data-and-maps/data/bathing-water-directive-status-of-bathing-water)
- **Alternativa:** Náyade (MITECO) si ofrece descarga sin clave
- **Campos:** calidad 2024/2025 (Excellent/Good/Sufficient/Poor), apta para baño
- **Estado:** ⚠️ Requiere verificación de URL de descarga CSV/Excel

### 5. Bandera Azul (`bandera-azul.mjs`)

- **Fuente:** [ADEAC - Bandera Azul](https://www.banderaazul.org)
- **Método:** Extracción de listado 2026 (PDF o página web)
- **Estado:** ⚠️ Requiere extracción manual o scraping

### 6. Servicios OSM (`osm-servicios.mjs`)

- **Fuente:** [OpenStreetMap via Overpass API](https://overpass-api.de/)
- **Radio:** 500 metros
- **Servicios:** parkings, aseos, paradas de autobús, información turística
- **Política de uso:** 1 solicitud/segundo, User-Agent personalizado
- **Opcional:** Puede deshabilitarse con `ENABLE_OSM=false`

### 7. Clima del Agua (`clima-agua.mjs`)

- **Fuente:** [Open-Meteo Marine API](https://marine-api.open-meteo.com/)
- **Datos:** Promedios mensuales de temperatura del agua (último año)
- **Opcional:** Puede deshabilitarse con `ENABLE_OPEN_METEO=false`
- **Estado:** ⚠️ Verificar disponibilidad de parámetros de temperatura de agua de superficie

### 8. Playas Cercanas (`cercanas.mjs`)

- **Método:** Cálculo de distancia haversine
- **Salida:** 3 playas más cercanas con distancia en km
- **Dependencia:** Requiere datos de `coordenadas.json`

### 9. Montar Fichas (`montar-fichas.mjs`)

- **Función:** Combina todas las fuentes en fichas individuales por playa
- **Salidas:**
  - `data/fichas/{slug}.json` - Ficha completa de cada playa
  - `data/informe-completitud.json` - Análisis de completitud
  - `data/informe-completitud.md` - Informe legible
  - `data/cruce-dudoso.json` - Cruces ambiguos (si los hay)

## 🤖 Automatización con GitHub Actions

El pipeline puede ejecutarse desde GitHub Actions de forma manual:

```yaml
# .github/workflows/actualizar-playas.yml
```

**Uso:**

1. Ir a "Actions" en GitHub
2. Seleccionar "Actualizar Datos de Playas"
3. Click en "Run workflow"
4. Elegir playas (slugs separados por comas) o "all"
5. El workflow descarga datos, procesa y hace commit automático

## ⚠️ Limitaciones Conocidas

### Datasets que requieren intervención manual

1. **Guía de Playas (MITECO):** URL de descarga directa debe verificarse en datos.gob.es
2. **Censo Aguas de Baño:** Requiere conversión de SHP/GeoPackage a GeoJSON
3. **Calidad del Agua:** URL de descarga de CSV/Excel debe verificarse en EEA
4. **Bandera Azul:** Listado 2026 debe extraerse de PDF o scraping

### Posibles bloqueos desde IPs cloud

Algunos sitios gubernamentales pueden bloquear o ralentizar solicitudes desde IPs de cloud. Si un script falla:

- Verificar el código de estado HTTP en el error
- Probar descarga manual desde navegador
- Buscar mirrors alternativos oficiales
- Documentar el fallo en el informe

### Políticas de uso de APIs

- **Nominatim OSM:** Máximo 1 req/s, User-Agent obligatorio
- **Overpass API:** Máximo 1 req/s, User-Agent obligatorio
- **Open-Meteo:** Sin límites de rate, pero uso razonable recomendado

## 📄 Licencias y Atribución

Todas las fuentes de datos son públicas y abiertas:

- **OpenStreetMap:** © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/)
- **MITECO (Guía de Playas, Censo):** Datos abiertos del Gobierno de España
- **EEA (Calidad del Agua):** Datos abiertos de la Agencia Europea de Medio Ambiente
- **Open-Meteo:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **ADEAC (Bandera Azul):** Datos públicos

Este repositorio es **público** y no contiene secretos, claves API ni datos personales.

## 🔧 Desarrollo

### Añadir una nueva fuente

1. Crear `scripts/nueva-fuente.mjs` siguiendo el patrón CLI
2. Implementar función de descarga/procesamiento
3. Usar `campo()` de `utils.mjs` para crear campos con proveniencia
4. Actualizar `montar-fichas.mjs` para integrar los nuevos campos
5. Añadir al script `pilot` en `package.json`
6. Documentar en este README

### Testing

Usar el flag `--only` para probar con 1-2 playas antes de ejecutar el pipeline completo:

```bash
node scripts/coordenadas.mjs --in data/beaches-master.json --out data/sources/coordenadas.json --only playa-de-san-juan
```

## 📞 Contacto

Para dudas sobre el pipeline: [GitHub Issues](../../issues)

---

**Welcome to Alicante** · Pipeline de Datos de Playas · 2026
