# 07 — Plan de trabajo

> **Alcance de este documento:** cómo se construye lo definido en los documentos anteriores — fases, orden, verificación y recortes.
> **Depende de:** [05 — Stack y arquitectura](./05_stack-y-arquitectura.md) · [06 — Tecnologías](./06_tecnologias.md) · [09 — Marca, interfaz y SEO](./09_marca-y-seo.md)

> **Este documento es también la traza del proyecto.** Lo que ya está hecho y verificado va ~~tachado~~. Una fase solo se tacha completa cuando su verificación pasó de verdad, no cuando el código existe.

---

## Marco

**ETHGlobal Tokyo 2026, 25–27 de septiembre, presencial, 36 horas. Dos personas.** Formato *Classic*: proyecto nuevo, repo creado durante el evento.

- **Punto de partida:** sábado 26, 05:45 JST. La definición (01–06 y 09), el kit de marca y los archivos de SEO ya están en el repo. No hay código.
- **Cierre:** domingo 27. **Hora exacta por confirmar en el sitio de ETHGlobal**; el plan asume **09:00 JST** y deja la entrega lista a las 07:00, con dos horas de margen.
- **Quién hace qué:** **A** = contratos (Solidity, Foundry, despliegue). **B** = `packages/core` y la web. Las fases 1 y 2 corren en paralelo; se juntan en la 3.
- **Dónde se despliega:** todo en **Base mainnet**, con dinero real y montos chicos. Las pruebas corren sobre un fork de Base.

Cada fase termina **demostrable y verificable**. Si el tiempo se acaba en cualquier punto, lo que hay ya sirve.

**Reglas que atraviesan todas las fases**, no negociables por velocidad:

1. **Nada llega a Base sin las pruebas de "lo prohibido debe fallar" del [05 §5](./05_stack-y-arquitectura.md#5-la-regla-que-no-puede-fallar-el-susds-del-apostador-nunca-sale-sin-sus-tokens-al-precio-que-firmó) en verde.** Es dinero real, de nosotros y de quien pruebe la demo.
2. **Commit y push al terminar cada tarea, no al final de la fase.** 1inch mira el historial, y cada commit tiene que caer dentro de la ventana del evento.
3. **Cada fase entra a `main` por pull request**, como dice [`AGENTS.md`](../../AGENTS.md). Un PR por fase, no por tarea: a este ritmo, más PRs es fricción sin revisión real.
4. **El feedback a 1inch se escribe en el momento** en [`spec/feedback/01_1inch.md`](../feedback/01_1inch.md), con la evidencia a mano.
5. **Se duerme por turnos.** Cuatro horas cada uno, escalonadas, para que siempre haya alguien despierto con el contexto. Una demo hecha sin dormir se rompe en vivo.

El detalle operativo —qué se corre antes de cada commit y en qué orden— vive en [`AGENTS.md`](../../AGENTS.md); el registro de cada cambio, en [`CHANGELOG.md`](../../CHANGELOG.md).

### Calendario (horas JST)

| Fase | Qué | Quién | Horas | Bloque |
| ---- | --- | ----- | ----- | ------ |
| ~~Def~~ | ~~Definición 01–06 y 09, kit de marca, feedback inicial~~ | ~~A + B~~ | — | ~~Hasta el sábado 05:45~~ |
| 0 | Andamiaje y compuerta del día 1 | A + B | 3 | Sábado 06:00–09:00 |
| ~~1~~ | ~~Contratos: opcodes, router, `OddsFlowTaker`, pruebas~~ | ~~A~~ | ~~10~~ | ~~Cerrada el sábado 26 a las 06:12 JST~~ |
| ~~2~~ | ~~`packages/core` y la web contra el fork~~ | ~~B~~ | ~~10~~ | ~~Cerrada el sábado 26 a las 07:00 JST~~ |
| 3 | Integración en Base: despliegue y llenado real | A + B | 5 | Sábado 19:00–domingo 00:00 |
| — | Turnos de sueño | A, luego B | 4 + 4 | A 00:00–04:00 · B 03:00–07:00 |
| 4 | Demo y entrega | A + B | 5 (escalonadas) | Domingo 00:00–07:00, margen hasta el cierre |

Una fase que se atrasa come de la siguiente según *Orden y recortes*, nunca de las reglas de arriba.

---

## Fase 0 — Andamiaje y compuerta

**Objetivo:** que las dos personas puedan trabajar en paralelo a las 09:00, y saber si el camino principal de los contratos funciona antes de invertir diez horas en él.

- ~~Unir los PR de documentación a `main` (PR #1 del README y el de `docs/spec-definicion`).~~
- ~~**B:** monorepo con pnpm workspaces; app de Next en `apps/web` armada alrededor de los archivos de marca y SEO ya existentes ([09 §9](./09_marca-y-seo.md#9-dónde-vive-cada-cosa)): `layout.tsx` con Barlow por `next/font`, `metadata`, `viewport` y `<JsonLd />`. `packages/core` vacío con Vitest y el umbral del 90 %. Biome. CI de GitHub Actions ([06 §5](./06_tecnologias.md#5-desarrollo-y-calidad)). Pre-commit en `.githooks`.~~
- **B:** crear el **mercado de la demo** en Seer con `pnpm demo:market` (ver *Decisiones del plan*).
- ~~**A:** `packages/contracts` con Foundry; `forge install` de `1inch/swap-vm@v1.0.2`, `1inch/aqua@0.1.0`, OpenZeppelin 5.4.0 y `solidity-utils` 6.9.7, con sus remappings; mismos ajustes de compilador que SwapVM.~~
- ~~**A, la compuerta:** en un fork de Base, desplegar un `AquaSwapVMRouter` con un `FixedPriceSwap` mínimo, publicar con `ship` en el **Aqua oficial** una orden `Deadline` + `FixedPriceSwap` para ese router, y llenarla con `quote` y `swap`. Confirmar de paso que la interfaz del Aqua desplegado coincide con el tag `0.1.0` ([06 §10](./06_tecnologias.md#10-pendientes)).~~
- Preguntar a los mentores de 1inch las preguntas abiertas del [feedback](../feedback/01_1inch.md#preguntas-abiertas-para-los-mentores), en persona, esa misma mañana.

**Verificación:** `pnpm check`, `pnpm test` y `forge build` corren en limpio en local y en CI; la web levanta con el favicon y el título de la marca; **la prueba de la compuerta pasa en el fork** con el precio fijo exacto, en `quote` y en `swap`.

> **Compuerta pasada el sábado 26 a las ~05:55 JST**, con el camino principal: `GateForkTest` llena a 0.20 exactos en `quote` y `swap`, exact-in y exact-out, sobre el Aqua oficial y un mercado real de Seer. El plan B por `Extruction` no hace falta.

**Compuerta, 09:00:** si la prueba no pasa antes de las 09:00, la fase 1 arranca con el plan B del [05](./05_stack-y-arquitectura.md#10-riesgos-técnicos): la misma lógica como contrato de `Extruction` en el router oficial. No se sigue peleando con el router redesplegado después de esa hora.

---

## Fase 1 — Contratos (A)

**Objetivo:** los dos opcodes, el router y `OddsFlowTaker`, con las pruebas del [05 §5](./05_stack-y-arquitectura.md#5-la-regla-que-no-puede-fallar-el-susds-del-apostador-nunca-sale-sin-sus-tokens-al-precio-que-firmó) y cubrimiento de 90 % o más.

- ~~`FixedPriceSwap`: exact-in y exact-out con redondeo a favor del maker, solo en la dirección declarada. Fuzz de precios y montos.~~
- ~~`OnlyUnresolvedCondition`: revierte con `payoutDenominator(conditionId) > 0`.~~
- ~~Router: `AquaSwapVMRouter` de `v1.0.2` con los dos opcodes en su tabla. Programa completo: `OnlyUnresolvedCondition` → `Deadline` → `FixedPriceSwap` → `Salt`. Correr `CoreInvariants`.~~
- ~~`OddsFlowTaker`: compra con creación de tokens para **una** orden (flash del sUSDS del maker, aporte de la contraparte, `splitPosition` en Seer, `push` del SÍ, reparto de inválidos, mínimo de la contraparte). Después, el recorrido de varias órdenes, de mayor a menor precio, saltando las que no pueden cubrir.~~
- ~~Las pruebas negativas del [05 §5](./05_stack-y-arquitectura.md#5-la-regla-que-no-puede-fallar-el-susds-del-apostador-nunca-sale-sin-sus-tokens-al-precio-que-firmó), todas, más "`OddsFlowTaker` termina con saldo cero".~~
- ~~Script de despliegue (`pnpm deploy:base`) con `--account deployer --verify`, probado contra el fork.~~
- ~~Medir el gas de una compra que recorre 1, 3 y 5 órdenes, y fijar el máximo ([05 §6](./05_stack-y-arquitectura.md#6-el-cálculo-central-el-precio-fijo-y-el-reparto-en-una-compra)).~~

> **Fase 1 verificada el sábado 26, 06:12 JST:** 46 pruebas en verde sobre el fork de Base — las 8 reglas del 05 §5 (`RulesForkTest`), 20 de `OddsFlowTaker`, `CoreInvariants` a 0.20, 0.37 y 0.99 — y cobertura de `src/` en 97 % líneas, 98 % sentencias, 92 % ramas, 95 % funciones. La compra de punta a punta con dos makers es `test_buy_sweepsOrdersBestFirst`. Los scripts de despliegue y del mercado de la demo corren en simulación contra Base.

**Verificación:** `pnpm test:contracts` en verde sobre el fork de Base, con las pruebas negativas y `CoreInvariants` incluidas, y `pnpm coverage:contracts` en 90 % o más; una compra de punta a punta en el fork (dos órdenes de dos makers, una contraparte, un mercado real de Seer) deja a cada uno con los tokens y el sUSDS esperados al centavo.

---

## Fase 2 — `packages/core` y la web (B)

**Objetivo:** las cinco pantallas del [04 §5](./04_diseno-de-solucion.md#5-pantallas), contra el router desplegado en un fork local, con las reglas de interfaz del [09 §7](./09_marca-y-seo.md#7-reglas-de-interfaz).

- ~~`packages/core`: direcciones de Base, construir el programa de una orden con la tabla de opcodes propia, `strategyHash`, libro de órdenes desde `Shipped` / `Docked`, estado derivado de cada orden, cálculo de una compra (qué órdenes, cuánto, precio promedio). Todo con pruebas; umbral del 90 %.~~
- ~~**La prueba que vale por dos:** el `strategyHash` de TypeScript coincide con el de Solidity. Se coordina con A a media fase.~~
- ~~Antes de construir la primera pantalla, proponer dos direcciones de composición y elegir una ([09 §10](./09_marca-y-seo.md#10-pendientes)). Quince minutos, no más.~~
- ~~Pantallas, en este orden: **Mercado** (comprar) → **Nuevas órdenes** (aprobar y publicar con `wallet_sendCalls`) → **Mis órdenes** (cancelar) → **Mercados** → **Posiciones** (cobrar).~~
- ~~Cada pantalla con todos sus estados ([09 §7](./09_marca-y-seo.md#7-reglas-de-interfaz)) y el resumen previo a cada firma.~~
- ~~`generateMetadata` en la página de mercado; `noindex` en las páginas de wallet.~~

> **Fase 2 verificada el sábado 26, ~07:00 JST**, contra el fork local (`scripts/dev-fork.sh`): desde la web se compró 100 NO llenando una orden YES a 0.25 (en la cadena: 100 NO y 75 inválidos al comprador por 75 sUSDS, 100 YES y 25 inválidos al maker por 25, `OddsFlowTaker` en cero), se publicaron dos órdenes de 10 000 sUSDS cada una con un saldo de 10 000, y se canceló una. `packages/core` en 100 % con la paridad de `strategyHash` en verde. **Sin verificar:** la vista de 390 px — la ventana del navegador de prueba no aceptó el cambio de tamaño; queda para revisión manual.
>
> **Hallazgo que cambia la demo:** el único mercado binario de Seer abierto en Base es el nuestro. Los otros 154 ya abrieron a respuestas o no son binarios. La demo de "dos mercados, un saldo" necesita un segundo mercado propio (`DEMO_MARKET_NAME` distinto con `pnpm demo:market`).

**Verificación:** `pnpm test` con el umbral cumplido y la prueba de paridad de `strategyHash` en verde; contra un fork local (`anvil --fork-url`) con el router de A, se publica una orden desde una cuenta, se compra desde otra y se cancela una tercera, todo desde la web; revisión en 390 px y 1440 px.

---

## Fase 3 — Integración en Base (A + B)

**Objetivo:** OddsFlow funcionando en Base mainnet, con un llenado real que cualquiera pueda comprobar en el explorador.

- Desplegar el router y `OddsFlowTaker` en Base, verificados en Basescan y en Sourcify. Direcciones y bloque de despliegue a `packages/core/src/addresses.ts`.
- Desplegar la web en Vercel con `NEXT_PUBLIC_SITE_URL`.
- **El flujo completo en Base, con dinero real y montos chicos:** el apostador publica dos órdenes (SÍ en el mercado de la demo y en uno existente) con una sola confirmación; la contraparte compra NO desde otra wallet y llena una de ellas; lo que puede cubrir la otra orden baja en la misma transacción; el apostador cancela la segunda.
- Checklist de SEO del [09 §8](./09_marca-y-seo.md#8-seo): Lighthouse, `view-source`, vista previa en X y en Discord.

**Verificación:** los hashes de las transacciones de publicar, comprar y cancelar, en Basescan, con las transferencias de sUSDS y de tokens de resultado esperadas. Van al `CHANGELOG.md` y a la sección *Evidence* del README.

---

## Fase 4 — Demo y entrega

**Objetivo:** que un juez entienda OddsFlow en dos minutos y pueda comprobar que funciona sin depender de nosotros.

- README público completo, sobre el esqueleto que ya está en [`README.md`](../../README.md): qué es, cómo correrlo, direcciones, evidencia con los hashes de la fase 3.
- Video de la demo (dos a cuatro minutos): el problema del [01](./01_contexto-y-problema.md) en una frase, publicar varias órdenes con un saldo, una compra que llena una, el saldo compartido bajando, y el opcode propio explicado en una pantalla.
- El cobro, mostrado sobre el fork, porque el mercado de la demo no se resuelve antes del cierre (ver *Decisiones del plan*).
- Cerrar el [feedback a 1inch](../feedback/01_1inch.md): tabla de resumen, reportes abiertos, respuestas de los mentores.
- Entrega en ETHGlobal a las 07:00, no en el último minuto.

**Verificación:** la entrega aparece en el panel de ETHGlobal con repo, video y enlace a la web; el enlace a la web muestra la tarjeta de vista previa correcta.

---

## Decisiones del plan

- **El mercado de la demo se crea el sábado temprano, con apertura a respuestas el lunes 28.** Las órdenes tienen que vencer, como tarde, en esa apertura ([04 §6](./04_diseno-de-solucion.md#6-reglas-de-negocio)), así que el mercado tiene que seguir abierto durante la demo del domingo. Consecuencia: no se resuelve antes del cierre, y **el cobro se muestra en el fork** avanzando el tiempo y respondiendo en Reality.eth. Es honesto y se dice así en la demo.
- **Dos mercados en la demo, los dos creados por nosotros.** El plan era el nuestro y uno existente de Seer, pero el 26 de septiembre no queda ningún otro mercado binario abierto en Base. El segundo mercado se crea con `pnpm demo:market` y otra pregunta.
- **El PR de `FixedPriceSwap` a `1inch/swap-vm` va después del hackathon** ([08](./08_roadmap.md)). En 27 horas no cabe prepararlo bien, y uno mal preparado es peor que ninguno.

---

## Orden y recortes

Si falta tiempo, se corta **en este orden**, de arriba hacia abajo:

1. **OG por mercado** ([09 §10](./09_marca-y-seo.md#10-pendientes)). Ya estaba fuera.
2. **Pantalla Posiciones.** El cobro se muestra en el fork desde un script, no desde la web.
3. **Recorrido de varias órdenes en una compra.** Cada compra llena una sola orden, la mejor.
4. **`wallet_sendCalls`.** Publicar pide una confirmación por orden.
5. **Pantalla Mercados.** Se entra a la demo por el enlace directo a cada mercado.
6. **El segundo mercado de la demo.** Solo el nuestro.

**Nunca se corta:**

- Las pruebas negativas del [05 §5](./05_stack-y-arquitectura.md#5-la-regla-que-no-puede-fallar-el-susds-del-apostador-nunca-sale-sin-sus-tokens-al-precio-que-firmó).
- **Al menos un llenado real en Base con dos órdenes del mismo saldo.** Es lo que pide el track, y es lo que demuestra la idea del [02](./02_solucion.md).
- El opcode propio, o su plan B por `Extruction` si la compuerta falla.
- Commits empujados durante todo el evento.

---

## Riesgos con fecha

Los riesgos técnicos y sus planes B están en el [05 §10](./05_stack-y-arquitectura.md#10-riesgos-técnicos). Aquí, **cuándo** se sabe cada uno:

| Riesgo | Se sabe | Si sale mal |
| --- | --- | --- |
| El router redesplegado no funciona con el Aqua oficial | Sábado 09:00 (compuerta) | Plan B: `Extruction` en el router oficial, desde la fase 1 |
| El split dentro de `preTransferInCallback` no funciona | Sábado ~14:00, primera compra de punta a punta en el fork | Solo camino de venta en la demo; la contraparte compra tokens en Seer y los vende a la orden |
| 1inch no valora el router redesplegado | Sábado por la mañana, con los mentores | Se mantiene el diseño; se presenta el plan B como alternativa ya probada |
| Crear el mercado en Seer pide un bond o un timeout inesperado | Sábado 09:00 | Se usan solo mercados existentes |
| Límites de `eth_getLogs` en el RPC | Fase 2, al cargar el libro | Leer en tramos desde el bloque de despliegue |
| Hora de cierre anterior a las 09:00 | Sábado, al confirmarla | Se corre el bloque de la fase 4 y se recorta desde arriba |

---

## Pendientes

- **Confirmar la hora exacta de cierre** de las entregas en el sitio de ETHGlobal, y corregir el calendario.
- **Nombres de A y B**, para que cada tarea tenga dueño.
