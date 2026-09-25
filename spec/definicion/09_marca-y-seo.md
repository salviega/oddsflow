# 09 — Marca, interfaz y SEO

> **Alcance de este documento:** cómo se ve, cómo habla y cómo se encuentra OddsFlow — marca, reglas de interfaz y SEO. Queda resuelto **antes** del plan de trabajo, para que ninguna fase tenga que inventar un color, un texto o una etiqueta `<title>`.
> **Depende de:** [02 — Solución](./02_solucion.md) · [04 — Diseño de la solución](./04_diseno-de-solucion.md) · [06 — Tecnologías](./06_tecnologias.md)

---

## 1. Origen del kit

El kit llegó hecho para otro nombre, **Floodgate**, con símbolo, paleta, tipografía, voz y archivos de SEO. Se decidió **mantener OddsFlow** y adaptar el kit, no al revés: el símbolo (una compuerta sobre un flujo) encaja igual o mejor con "flow".

Qué se cambió al adaptarlo (26 de septiembre de 2026):

- **Wordmark "oddsflow"**, regenerado con la misma fuente y los mismos parámetros que el original: Barlow SemiBold, 36 px, línea base en y = 45, tracking −0,36. Se calibró reproduciendo "floodgate" hasta que su caja coincidió con la del archivo original al centésimo, y con esos parámetros se contorneó "oddsflow". Contorneado a paths: se ve igual sin la fuente instalada.
- **OG image:** nuevo wordmark, y "Your USDC" pasa a **"Your sDAI"**, que es el colateral real ([03](./03_bounties.md#marco)).
- **`site.ts`:** nombre, URL, repo y descripción; se agregan "Seer" y la red ("Gnosis Chain" desde la mudanza del 26 de septiembre) a las palabras clave.
- **JSON-LD:** `codeRepository` no es una propiedad de `WebApplication` en schema.org; pasa a `sameAs`, y se agrega `isAccessibleForFree`.
- **`robots.ts`:** se quita `host`, que Google ignora.
- **Voz:** se agregan "Cancel order" (no "dock") e "Invalid result" (no "INVALID outcome token").
- **Contraste:** el kit decía "Silt para texto terciario"; no llega a AA (§3), así que Silt queda para bordes y texto grande.

Sin cambios: el símbolo, los íconos PNG (solo llevan el símbolo), la paleta y la tipografía.

---

## 2. Símbolo y logo

**Qué significa.** Una compuerta entre dos postes, sobre un flujo. La barra amarilla es la compuerta y es también el precio que pone el apostador: se queda en un nivel de la escala. El flujo pasa solo cuando llega a ese nivel. Es el argumento del [02](./02_solucion.md#qué-es) en una imagen: el dinero se queda quieto hasta que alguien toma el otro lado.

| Archivo | Uso |
| --- | --- |
| `brand/logo.svg` / `logo-dark.svg` | Horizontal, símbolo + wordmark. `-dark` sobre fondos oscuros |
| `brand/mark.svg` / `mark-dark.svg` | Solo el símbolo |
| `apps/web/public/favicon.svg` | Símbolo sobre una baldosa Lock, para la pestaña |
| `apps/web/public/icon-16.png` | Símbolo simplificado (sin flujo) para 16 px |

**Espacio y tamaño mínimo:** margen igual al hueco entre los dos postes; 16 px el símbolo (con el ícono simplificado), 96 px de ancho el logo horizontal.

**Lo que no se hace:** rotar, inclinar o poner degradados; bajar la compuerta por debajo del flujo; pintar la compuerta de verde o rojo (es un precio, no un lado); texto largo en Gauge; el logo sobre imágenes sin capa de contraste.

---

## 3. Color

| Rol | Hex | Uso |
| --- | --- | --- |
| **Lock** | `#0F2B2E` | Fondo principal; texto sobre superficies claras |
| **Spillway** | `#E7EAE4` | Texto sobre fondo oscuro; superficies claras |
| **Gauge** | `#F2C12E` | El único acento: el nivel de precio, la acción principal, rellenos |
| **Mist** | `#A9B8B5` | Texto secundario sobre Lock |
| **Silt** | `#7D8F8C` | Bordes, divisores, metadatos en tamaño grande |
| **Yes** | `#2E9E57` | El lado SÍ de un mercado, y solo eso |
| **No** | `#D2483E` | El lado NO de un mercado, y solo eso |

**Contraste medido (WCAG 2.x), sobre Lock:**

| Color | Contraste | Sirve para |
| --- | --- | --- |
| Spillway | 12,30 | Todo |
| Gauge | 8,85 | Todo; también Lock sobre Gauge (8,85) para el texto del botón principal |
| Mist | 7,27 | Todo |
| Silt | 4,40 | Bordes, íconos y texto ≥ 24 px (o ≥ 18,66 px en negrita). **No texto de cuerpo** |
| Yes | 4,37 | Rellenos, barras, bordes y texto grande. **No texto de cuerpo** |
| No | 3,37 | Rellenos, barras, bordes y texto grande. **No texto de cuerpo** |

Sobre Spillway solo Lock llega a AA (12,30); Gauge (1,39), Mist (1,69), Silt (2,80) y Yes (2,81) no se usan sobre fondo claro. **La interfaz es oscura** (Lock de fondo); Spillway como superficie es la excepción.

**Reglas:**

1. **Un solo acento.** Gauge marca el precio y la acción principal de cada pantalla. Nada más es amarillo.
2. **Yes y No son lados, no estados.** Nunca significan éxito o error, ganancia o pérdida. Y **siempre van con la palabra**: una barra verde sin "YES" al lado no informa a quien no distingue verde de rojo.
3. **Los errores no dependen del color.** Texto Spillway con borde Silt y una explicación escrita de qué pasó y qué hacer.

Los siete colores son tokens de Tailwind en `apps/web/src/app/globals.css` (`bg-lock`, `text-mist`, `border-silt`, etc.).

---

## 4. Tipografía

**Barlow**, una grotesca dibujada a partir de la señalética de carreteras y obras públicas: encaja con un producto hecho de compuertas y flujos. Licencia SIL OFL (`brand/Barlow-OFL.txt`). La web la carga con `next/font` como `--font-barlow`, sin petición a Google en tiempo de ejecución y sin salto de diseño al cargar.

| Peso | Uso |
| --- | --- |
| 400 | Cuerpo |
| 500 | Etiquetas y datos |
| 600 | Titulares y wordmark |

**`tabular-nums` en todo precio, monto y saldo**, para que las columnas no bailen cuando cambian los números.

---

## 5. Números

Aquí es donde una interfaz financiera se rompe primero.

| Qué | Formato | Ejemplo |
| --- | --- | --- |
| Precio | Decimal 0.00–1.00, dos decimales | `0.20` |
| Probabilidad implícita | En Mist, al lado del precio | `0.20 · 20%` en tablas, `0.20 (20%)` en texto |
| Monto | sDAI, dos decimales, miles agrupados, unidad siempre | `1,000.00 sDAI` |
| Equivalente en dólares | En Mist, después del monto, con `≈` | `≈ $1,052.40` |
| Cantidad de tokens | Dos decimales, con el lado | `100.00 YES` |
| Monto demasiado chico | Umbral, no ceros | `< 0.01 sDAI` |

El dólar es una ayuda, **nunca la cifra que se firma** ([04 §5](./04_diseno-de-solucion.md#5-pantallas)). Ningún número muestra los 18 decimales de la cadena; el valor exacto está en "Details".

---

## 6. Voz y textos

Palabras de lo que hace el usuario, no de cómo funciona el protocolo. La interfaz está en inglés ([`AGENTS.md`](../../AGENTS.md)).

| Se dice | No se dice |
| --- | --- |
| Order | Strategy, position, ship |
| Filled | Executed, matched on Aqua |
| Available balance | Virtual balance |
| Expires | Deadline, docked |
| Cancel order | Dock |
| Claim | Redeem positions |
| Invalid result | INVALID outcome token |

**Botones con verbo y objeto, nunca "Continue" o "Confirm":**

| Momento | Botón |
| --- | --- |
| Primera aprobación | `Allow OddsFlow orders to use your sDAI` |
| Publicar | `Place 2 orders` |
| Comprar | `Buy 100.00 NO for 80.00 sDAI` |
| Cancelar | `Cancel order` |
| Cobrar | `Claim 100.00 sDAI` |

**Errores:** qué pasó y qué hacer. "This order can cover 300.00 sDAI today — your wallet has less than the order's limit. Add sDAI or lower the amount." No "Transaction failed". Sin signos de exclamación, sin tono de celebración: es dinero.

---

## 7. Reglas de interfaz

**El estado es el producto.** Antes de construir cada componente se listan todos sus estados, incluidos los feos:

| Objeto | Estados que la interfaz dibuja |
| --- | --- |
| Orden | `Active` · `Filled` · `Expired` · `Cancelled` · y, sobre `Active`, la lectura "can cover X today" cuando el saldo real es menor que el tope ([04 §6](./04_diseno-de-solucion.md#6-reglas-de-negocio)) |
| Transacción | Esperando la firma · enviada, sin confirmar · confirmada (con enlace al explorador) · revertida (con el motivo en palabras) |
| Datos | Cargando (skeleton, nunca spinner a pantalla completa) · vacío (qué es esto y cómo se empieza) · error de red (qué no se pudo leer, reintentar) · desactualizado (hace cuánto se leyó) |
| Wallet | Sin conectar (la app se explica igual, con mercados visibles) · red equivocada (cambiar a Gnosis) · sin sDAI · sin aprobación |

**El momento de la firma es el pico de cada flujo.** Antes de cada firma, sin scroll y sin jerga, se ve:

| Firma | Qué se mueve | Qué va a pasar | Qué **no** pasa | Qué se puede deshacer |
| --- | --- | --- | --- | --- |
| Aprobar sDAI a Aqua | Nada | Aqua puede usar tu sDAI solo cuando se llena una de tus órdenes | OddsFlow no recibe permiso sobre tu sDAI | Revocable en cualquier momento |
| Publicar órdenes | Nada; paga gas | Cada orden espera en su mercado, a su precio, hasta que vence | Tu sDAI no sale de la wallet | Cancelar cuando quieras |
| Comprar | Tu sDAI | Recibes los tokens en esta transacción, a este precio o mejor | No pagas más que el mínimo que fijaste | **Irreversible** una vez confirmada |
| Cancelar | Nada; paga gas | La orden deja de poder llenarse | No afecta lo ya llenado | No: hay que publicarla de nuevo |
| Cobrar | Tokens ganadores → sDAI | Recibes sDAI por tus tokens ganadores | — | **Irreversible** |

"Irreversible" se escribe con esa palabra. Y el riesgo de la orden con precio viejo del [04](./04_diseno-de-solucion.md#6-reglas-de-negocio) aparece al publicar, no en un tooltip.

**Lo técnico está a un clic, nunca por defecto.** `strategyHash`, programa, `conditionId`, direcciones y hash de transacción van detrás de "Details".

**Piso de accesibilidad:** contraste AA (§3), foco visible en Gauge, objetivos táctiles de 44 px, nada que dependa solo del color. Se revisa en 390 px y en 1440 px, con nombres de mercado largos y montos grandes.

**Se rechaza:** spinners a pantalla completa, modales sobre modales, tooltips con información necesaria para decidir, un botón destructivo al lado del principal, errores en toasts que desaparecen, botones deshabilitados sin decir por qué, y "Connect wallet" como pantalla vacía.

---

## 8. SEO

**Qué se busca.** En un hackathon, el SEO que más importa es **la vista previa del enlace**: jueces y sponsors ven OddsFlow primero como una tarjeta en X, Discord o Telegram. Después, que "prediction market limit orders" o "1inch Aqua prediction markets" lleven a la web, y que cada mercado tenga su propia página indexable.

**Una sola fuente.** `apps/web/src/lib/site.ts` tiene el nombre, el título, la descripción, las palabras clave y la imagen OG. `metadata.tsx`, `manifest.ts`, `robots.ts` y `sitemap.ts` leen de ahí; ningún texto de SEO se escribe en dos lugares.

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| Título y descripción | `metadata.tsx` | `OddsFlow — Limit orders for prediction markets`; plantilla `%s — OddsFlow` para cada página. Descripción de 150 caracteres, bajo el corte de 160 |
| Open Graph y X | `metadata.tsx` + `public/og-image.png` | Tarjeta grande 1200 × 630 con el titular "One balance. Every market." |
| Datos estructurados | `metadata.tsx` (`JsonLd`) | `WebApplication`, categoría `FinanceApplication`, gratis, con el repo en `sameAs` |
| Canonical | `metadata.tsx` | `alternates.canonical` en cada página |
| Íconos y PWA | `metadata.tsx` + `manifest.ts` | Favicon SVG e ICO, apple-touch 180, manifest con íconos 192/512 y maskable |
| `robots.txt` | `robots.ts` | Todo rastreable, con el sitemap |
| `sitemap.xml` | `sitemap.ts` | `/` y las páginas de mercado |

**Qué se indexa y qué no:**

| Ruta | Indexable | Por qué |
| --- | --- | --- |
| `/` (Mercados) | Sí | La portada |
| `/markets/[address]` | Sí | Contenido propio: la pregunta y los precios. `generateMetadata` arma el título con la pregunta y la descripción con el mejor precio de cada lado |
| `/orders/new`, `/orders`, `/positions` | No (`walletPageRobots`) | Dependen de la wallet conectada: vacías para un buscador |

Las páginas de wallet llevan `noindex` en la etiqueta meta, **no** `Disallow` en `robots.txt`: un buscador que no puede pedir la página tampoco lee el `noindex`.

**Rendimiento, que también es SEO:** Barlow con `next/font` (sin salto de diseño), la portada renderizada en el servidor con los mercados ya leídos para que el HTML tenga contenido, y `tabular-nums` para que los números no muevan el diseño al actualizarse.

**Cómo se verifica** (al cerrar la fase de la web del [07](./07_plan-de-trabajo.md)):

- Lighthouse, categoría SEO: 100 en `/` y en una página de mercado.
- `view-source` de `/`: `<title>`, `<meta name="description">`, `og:image` absoluto y el JSON-LD presentes en el HTML inicial.
- Vista previa real: pegar la URL en X y en Discord, y comprobarla en un validador de Open Graph.
- Rich Results Test de Google sobre el JSON-LD: sin errores.
- `/robots.txt`, `/sitemap.xml` y `/manifest.webmanifest` responden.

---

## 9. Dónde vive cada cosa

| Qué | Dónde |
| --- | --- |
| Fuentes de diseño (SVG) y referencia rápida | `brand/` (`README.md` en inglés) |
| Lo que sirve la web | `apps/web/public/` |
| Tokens de color y fuente | `apps/web/src/app/globals.css` |
| Texto y datos de SEO | `apps/web/src/lib/site.ts` |
| Metadata, manifest, robots, sitemap | `apps/web/src/app/` |

Estos archivos se crearon antes que la app de Next. La fase 0 del [07](./07_plan-de-trabajo.md) arma la app alrededor de ellos: `layout.tsx` exporta `metadata` y `viewport`, carga Barlow con `next/font` (400, 500, 600) como `--font-barlow`, importa `globals.css` y dibuja `<JsonLd />`.

---

## 10. Pendientes

- ~~**Dominio.**~~ Producción en `https://oddsflow-teal.vercel.app` (`oddsflow.vercel.app` ya estaba tomado). **Lección del 26 de septiembre:** el primer despliegue apuntó el canonical y `og:image` a `oddsflow-santiago-a-viana-vs-projects.vercel.app`, un alias que Vercel protege con login; WhatsApp encontró el login en vez de la imagen y no mostró la tarjeta. `site.ts` ahora cae a la URL de producción que informa Vercel si falta `NEXT_PUBLIC_SITE_URL`.
- **OG por mercado.** Una imagen generada por página de mercado (pregunta y precio sobre la escala) con `ImageResponse` de Next. Mejora la vista previa al compartir un mercado; no es necesaria para la demo.
- **Dirección visual de las pantallas.** El kit fija color, tipo y voz; la composición de las cinco pantallas del [04](./04_diseno-de-solucion.md#5-pantallas) (densidad, qué va arriba) se decide al empezar la fase de la web, con dos direcciones propuestas antes de construir una.
