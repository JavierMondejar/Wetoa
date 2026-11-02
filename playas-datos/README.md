# Pipeline de Datos para Playas de Alicante

Pipeline automatizado para recopilar datos verificables de playas de la provincia de Alicante para Welcome to Alicante.

## ✅ Principio Fundamental: Solo Datos Verificables

**CRÍTICO:** Cada valor debe venir de un archivo/página descargado en tiempo de ejecución, con su URL verificable. 

❌ **Prohibido:** Datos inventados o hardcodeados por el agente  
✅ **Permitido:** Solo datos de fuentes descargables con URL de proveniencia

Cuando una fuente falla:
```json
{
  "valor": null,
  "estado": "por confirmar"
}
```

## 📊 Fuentes de Datos (Estado Actual)

### 1. ✅ Coordenadas (Nominatim + Overpass OSM)
- **URL:** https://nominatim.openstreetmap.org
- **Método:** Búsqueda directa + fallback por área de municipio
- **Política:** 1 req/s, User-Agent personalizado
- **Variantes:** Búsqueda con nombres valencianos automáticos
- **Estado:** Funcional, ~80% cobertura esperada

### 2. ⚠️ Guía de Playas (MITECO - datos.gob.es)
- **URL catálogo:** https://datos.gob.es/apidata/catalog/dataset/e0dat0002-guia-de-playas-de-espana
- **Problema:** CKAN API no devuelve distribuciones en formato esperado
- **Estado:** No funcional, requiere URL directa del CSV/JSON

### 3. ✅ Censo de Aguas de Baño (MITECO)
- **URL descarga:** https://www.miteco.gob.es/content/dam/miteco/es/cartografia-y-sig/ide/descargas/01-agua/censo_zonas_bano.zip
- **Método:** Descarga ZIP, extracción SHP, conversión GeoJSON automática
- **Filtro:** Provincia Alicante
- **Estado:** Implementado, pendiente de prueba

### 4. ⚠️ Calidad del Agua (EEA)
- **URL:** https://www.eea.europa.eu/api/SITE/downloads/bathing-water-quality/bw-qual-assessments-2023.csv
- **Problema:** Campo de país a identificar (countryCode 'ES' vs 'SPAIN')
- **Estado:** CSV se descarga, filtro a corregir

### 5. ⚠️ Bandera Azul 2026
- **URL:** https://www.valenciabonita.es/2026/05/05/banderas-azules-comunitat-valenciana-2026/
- **Método:** Scraping de artículo periodístico (mayo 2026)
- **Confianza:** Media (fuente de prensa, no PDF oficial ADEAC)
- **Estado:** Implementado, extracción HTML a refinar

### 6. ⚠️ Servicios OSM (Overpass API)
- **URLs:** overpass-api.de, overpass.kumi.systems, overpass.private.coffee
- **Timeout:** 90s en query, 120s en HTTP
- **Radio:** 300m (reducido para queries rápidas)
- **Política:** 1 req/s, retry con backoff
- **Estado:** Implementado, timeouts frecuentes en pruebas

### 7. ⚠️ Temperatura del Agua (Open-Meteo Marine)
- **URL:** https://marine-api.open-meteo.com/v1/marine
- **Parámetro:** `sea_surface_temperature` (hourly)
- **Problema:** Verificar disponibilidad de datos históricos
- **Estado:** Parámetro corregido, pendiente prueba

### 8. ✅ Playas Cercanas (Cálculo Haversine)
- **Método:** Cálculo geométrico local
- **Estado:** 100% funcional

## 🏗️ Arquitectura

```
playas-datos/
├── scripts/                    # 10 scripts ESM
│   ├── utils.mjs              # Funciones comunes
│   ├── coordenadas.mjs        # Nominatim + Overpass fallback
│   ├── guia-playas.mjs        # CKAN API (no funciona aún)
│   ├── censo-aguas-bano.mjs   # ZIP→SHP→GeoJSON automático
│   ├── calidad-agua.mjs       # EEA CSV (campo país a corregir)
│   ├── bandera-azul.mjs       # Scraping Valencia Bonita
│   ├── osm-servicios.mjs      # Overpass con retry
│   ├── clima-agua.mjs         # Open-Meteo Marine SST
│   ├── cercanas.mjs           # Haversine
│   └── montar-fichas.mjs      # Combina todas las fuentes
├── data/
│   ├── beaches-master.json    # 127 playas desde Notion
│   ├── sources/               # Datos por fuente (generados)
│   ├── fichas/                # Fichas finales (generadas)
│   └── informe-completitud.md # Reporte automático
├── package.json               # Dependencias: shapefile, pdf-parse, adm-zip
└── .gitignore                 # Excluye: node_modules, data/raw, cache, *.zip, *.shp

```

## 🚀 Uso

### Ejecución Local

```bash
cd playas-datos
npm install  # Solo primera vez

# Piloto (5 playas)
npm run pilot

# Script individual
node scripts/coordenadas.mjs \
  --in data/beaches-master.json \
  --out data/sources/coordenadas.json \
  --only playa-de-san-juan,playa-del-postiguet

# Todas las playas
node scripts/coordenadas.mjs \
  --in data/beaches-master.json \
  --out data/sources/coordenadas.json
```

### Variables de Entorno

```bash
# Deshabilitar módulos opcionales
ENABLE_NOMINATIM=false node scripts/coordenadas.mjs ...
ENABLE_OSM=false node scripts/osm-servicios.mjs ...
ENABLE_OPEN_METEO=false node scripts/clima-agua.mjs ...
```

## 📦 Sistema de Proveniencia

Cada campo incluye su origen completo:

```json
{
  "tipo_arena": {
    "valor": "Fina dorada",
    "fuente": "Guía de Playas de España (MITECO)",
    "url": "https://datos.gob.es/...",
    "fecha": "2026-11-02",
    "metodo": "dataset",
    "confianza": "alta"
  }
}
```

Campos sin datos verificables:

```json
{
  "longitud_m": {
    "valor": null,
    "estado": "por confirmar"
  }
}
```

## ⚠️ Limitaciones Conocidas

### No Resueltas (Requieren intervención)

1. **Guía de Playas (MITECO)**
   - CKAN API devuelve estructura inesperada
   - Requiere URL directa del CSV descargable
   - Verificar manualmente en datos.gob.es

2. **Calidad del Agua (EEA)**
   - CSV se descarga pero filtro por país falla
   - Identificar campo correcto: `countryCode`, `country_code`, etc.
   - Posibles valores: 'ES', 'SPAIN', 'Spain', 'ESP'

3. **Overpass API**
   - Timeouts frecuentes incluso con 90s
   - Posible bloqueo desde IPs cloud
   - Considerar deshabilitar o queries aún más simples

4. **Open-Meteo Marine**
   - Parámetro `sea_surface_temperature` corregido
   - Verificar si datos históricos disponibles
   - Si no, reportar y dejar campo en null

5. **Bandera Azul**
   - Extracción HTML de Valencia Bonita implementada
   - Requiere refinar regex de extracción
   - Confianza media (fuente periodística, no oficial)

## 📝 Desarrollo

### Añadir Nueva Fuente

1. Crear `scripts/nueva-fuente.mjs` con patrón CLI estándar
2. Descargar desde URL pública sin autenticación
3. Usar `campo()` de utils.mjs para todos los valores
4. Documentar URL, método y limitaciones en README
5. Actualizar `montar-fichas.mjs` para integrar campos
6. Añadir a `npm run pilot`

### Testing

Probar con 1-2 playas antes del lote completo:

```bash
node scripts/coordenadas.mjs \
  --in data/beaches-master.json \
  --out data/sources/coordenadas.json \
  --only playa-de-san-juan
```

## 📄 Licencias y Atribución

- **OpenStreetMap:** © OpenStreetMap contributors, ODbL
- **MITECO (Guía Playas, Censo):** Datos abiertos Gobierno España
- **EEA:** Datos abiertos Agencia Europea Medio Ambiente
- **Open-Meteo:** CC BY 4.0
- **Valencia Bonita:** Artículo periodístico citado con URL

## 🔧 Troubleshooting

**Timeout en Overpass:**
- Aumentar timeout en utils.mjs (actual: 120s)
- Reducir radio de búsqueda (actual: 300m)
- Simplificar queries (menos tipos de servicios por llamada)

**CKAN API sin resultados:**
- Verificar estructura de respuesta con curl
- Buscar URL alternativa en portal datos.gob.es
- Considerar scraping directo del portal

**Censo ZIP no se extrae:**
- Verificar que adm-zip y shapefile están instalados
- Revisar permisos de /tmp/censo_aguas
- Inspeccionar contenido del ZIP manualmente

## 📞 Soporte

Para issues técnicos: [GitHub Issues](../../issues)

---

**Welcome to Alicante** · Pipeline de Datos de Playas · 2026
