# 05 — Stack y arquitectura

> **Alcance de este documento:** cómo se construye — decisiones técnicas, arquitectura, dónde vive el estado, permisos, costos y riesgos. **No repite el diseño de producto.**
> **Depende de:** [03 — Bounties](./03_bounties.md) · [04 — Diseño de la solución](./04_diseno-de-solucion.md)

---

## 1. Decisiones

Cada una con lo que se descartó y por qué. Las tres primeras vienen del [03](./03_bounties.md#1-1inch--build-an-aqua-app).

| Decisión | Se elige | Se descarta | Por qué |
| --- | --- | --- | --- |
| Red | **Gnosis Chain** (desde el 26 de septiembre). Pruebas sobre un fork de Gnosis | Base mainnet (primer despliegue) · testnets | En Base no quedaba ningún mercado de Seer operable salvo los nuestros; Gnosis tiene 131 binarios abiertos. Aqua no tiene testnets ([03](./03_bounties.md#marco), [feedback](../feedback/01_1inch.md)) |
| Motor de la orden | **Aqua oficial** (`0x1111113c…a90a`) + **router de SwapVM propio**: `AquaSwapVMRouter` del tag `v1.0.2` con dos opcodes nuevos | Router oficial con `Extruction` · `LimitSwap` · `AquaApp` propio | El router oficial no tiene precio fijo y `LimitSwap` no sirve sobre saldos de Aqua ([03 §1](./03_bounties.md#1-1inch--build-an-aqua-app)). `Extruction` en el oficial queda como plan B |
| Programa de una orden | `OnlyUnresolvedCondition(conditionId)` → `Deadline(vencimiento)` → `FixedPriceSwap(precio, tokenResultado → sDAI)` → `Salt` | Varias órdenes en una sola estrategia | Una orden por estrategia: cancelar una es un `dock` que no toca las demás, y cada una tiene su tope en su propio saldo virtual. `Salt` evita que dos órdenes idénticas tengan el mismo `strategyHash` |
| Versión de SwapVM | **Tag `v1.0.2`**, el ABI desplegado: `swap(order, tokenIn, tokenOut, amount, takerData)` | `main` | `main` cambió la firma de `swap` y el layout de fuentes ([feedback](../feedback/01_1inch.md)). El tag permite comparar nuestro router con el oficial línea por línea: la única diferencia son los dos opcodes |
| Compra con creación de tokens | **`OddsFlowTaker`**, un contrato que hace de taker en SwapVM: recorre órdenes, junta los aportes, hace el split en Seer y reparte | Que la interfaz encadene varias transacciones | El [04](./04_diseno-de-solucion.md#42-contraparte-comprar-un-lado) promete una sola transacción y "todo o nada". Solo un contrato puede juntar el sDAI del maker y el de la contraparte antes del split |
| Venta de tokens existentes | El vendedor llama al router directamente, o vía `OddsFlowTaker` para recorrer varias órdenes | Un camino exclusivo de OddsFlow | La orden no distingue quién la llena ([04 §4.3](./04_diseno-de-solucion.md#43-vendedor-vender-tokens-a-una-orden)) |
| Publicar y cancelar | La wallet del apostador llama a `aqua.ship` y `aqua.dock` **directamente**. Varias órdenes en una confirmación con `wallet_sendCalls` (EIP-5792) cuando la wallet lo admite | Un contrato de OddsFlow que publique en nombre del apostador | Aqua toma como maker a `msg.sender` de `ship`: un intermediario sería el maker y el sDAI se pediría a él. Ver §5 |
| Libro de órdenes | **Eventos de Aqua** (`Shipped`, `Docked`) filtrados por `app == router de OddsFlow`, decodificados en `packages/core` | Subgraph o backend propio | `Shipped` trae el programa completo. Nada que guardar que no esté ya en la cadena |
| Mercado de la demo | **Un mercado binario creado por nosotros** en Seer, con `MarketFactory` en Gnosis | Mercados existentes | Controlamos la pregunta, la fecha de apertura a respuestas y la resolución, así que la demo puede llegar hasta el cobro. Los mercados existentes siguen funcionando igual |
| Estado propio | **Ninguno** | Base de datos de órdenes o llenados | Todo vive en Aqua, en el router, en Seer y en Reality.eth. Cada dato fuera de la cadena es un dato que puede mentir |
| Repositorio | **Monorepo**: contratos, núcleo en TypeScript y web | Repos separados | Un solo historial de commits (lo mira 1inch), un solo `install`, y el mismo código construye un programa en TypeScript y lo verifica contra Solidity |

Las tecnologías concretas (toolchain de contratos, framework web, librería de wallet) y sus versiones se fijan en el [06](./06_tecnologias.md).

---

## 2. Arquitectura

Una cadena, tres protocolos externos y tres piezas nuestras: el router con los opcodes, `OddsFlowTaker` y la web. Ninguna pieza nuestra guarda fondos entre transacciones.

```
┌─ Web de OddsFlow (navegador) ─────────────────────────────────────────────┐
│  lee: eventos de Aqua, saldos, mercados de Seer, Reality.eth             │
│  firma con la wallet del usuario: approve · ship · dock · buy · redeem   │
└───────┬───────────────────────────┬──────────────────────────┬───────────┘
        │ apostador                 │ contraparte              │ apostador
        │ ship / dock               │ buy(mercado, lado, ...)  │ redeemPositions
        ▼                           ▼                          ▼
┌─ Gnosis Chain ────────────────────────────────────────────────────────────┐
│                                                                           │
│  Aqua (oficial)                    OddsFlowTaker (nuestro, sin dueño)     │
│   saldos virtuales por orden        recorre órdenes · split · reparte    │
│   pull() ─────── sDAI del maker ──► │                                   │
│   push() ◄────── token de resultado ─┤                                   │
│      ▲                               │ swap()                            │
│      │ pull / push / safeBalances    ▼                                   │
│  Router SwapVM de OddsFlow  ◄────────┘                                   │
│   AquaSwapVMRouter v1.0.2 + FixedPriceSwap + OnlyUnresolvedCondition    │
│      │ lee payoutDenominator                                             │
│      ▼                                                                   │
│  Seer: GnosisRouter (split) · Market · Conditional Tokens ◄── Reality.eth      │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Cómo se hablan:** el apostador habla con Aqua y nada más. La contraparte habla con `OddsFlowTaker`, que es el taker ante el router. El router habla con Aqua para mover fondos y con Conditional Tokens para saber si el mercado se resolvió. `OddsFlowTaker` habla con el Router de Seer para el split.

**Qué no habla con qué:** ninguna pieza de OddsFlow tiene aprobación sobre el sDAI de un apostador; solo Aqua la tiene, y solo la usa cuando la llama el router de la estrategia. La web no tiene backend: no hay servidor que pueda firmar, pausar ni elegir qué orden se llena.

---

## 3. Estructura del proyecto

Monorepo. Los nombres son tentativos hasta el [06](./06_tecnologias.md); la división no.

```
oddsflow/
├── spec/                      esta documentación
├── apps/
│   └── web/                   la web: mercados, nuevas órdenes, mis órdenes, posiciones
├── packages/
│   ├── contracts/             router con los dos opcodes, OddsFlowTaker, scripts de despliegue, pruebas en fork de Gnosis
│   └── core/                  TypeScript compartido: construir el programa de una orden, decodificar el libro, direcciones
└── .github/workflows/         typecheck · lint · pruebas de contratos · build
```

`packages/core` existe para que **no haya dos definiciones de "qué es una orden"**: la web construye y decodifica programas con el mismo código, y las pruebas de contratos comprueban que el `strategyHash` que produce TypeScript coincide con el de Solidity.

---

## 4. Dónde vive el estado

No hay base de datos. El [04](./04_diseno-de-solucion.md#3-modelo-de-datos) define cada campo; aquí, quién es la fuente de verdad de cada uno.

| Dato | Fuente de verdad | Cómo se lee |
| --- | --- | --- |
| Órdenes de un apostador y su programa | Eventos `Shipped` de Aqua con `app == router de OddsFlow` | `eth_getLogs` desde el bloque de despliegue del router; el programa se decodifica con `packages/core` |
| Orden cancelada | Evento `Docked` | Mismo filtro |
| Tope restante (`tope − llenado`) | Saldo virtual de sDAI en Aqua | `aqua.rawBalances(maker, router, strategyHash, sDAI)` |
| Lo que la orden puede cubrir hoy | Derivado: mínimo entre tope restante, saldo real de sDAI y aprobación a Aqua | `balanceOf` y `allowance` del maker |
| Llenados | Eventos `Swapped` del router (y los del split de Seer en la misma transacción) | `eth_getLogs`; `via` = `creación` si el taker es `OddsFlowTaker` y hubo split |
| Estado de la orden | Derivado | `Docked` → `cancelada`; saldo virtual 0 → `llenada`; `vencimiento` pasado o condición resuelta → `vencida`; si no, `activa` |
| Mercado: pregunta, tokens, condición | Contrato `Market` de Seer | `marketName()`, `wrappedOutcome(i)`, `conditionId()` |
| Mercado: apertura a respuestas | Reality.eth en Gnosis (`0xE789…05cc`) | `getOpeningTS(questionsIds()[0])` |
| Mercado resuelto | Conditional Tokens de Seer en Gnosis (`0xCeAf…c0Ce`) | `payoutDenominator(conditionId) > 0` |
| Posiciones | Saldos ERC20 de los tokens de resultado | `balanceOf` |

**Lo único efímero:** el estado de la interfaz en el navegador. No es fuente de nada.

---

## 5. La regla que no puede fallar: el sDAI del apostador nunca sale sin sus tokens, al precio que firmó

Es la regla del [04 §6](./04_diseno-de-solucion.md#6-reglas-de-negocio). Se garantiza en cinco capas, y ninguna depende de la web ni de `OddsFlowTaker`.

**a) Nadie más que el apostador publica o cancela sus órdenes.** Aqua identifica al maker como `msg.sender` de `ship` y `dock`. OddsFlow no tiene ninguna función que haga `ship` o `dock`, ni aprobación sobre ningún token de un apostador: la única `approve` del apostador es hacia Aqua.

**b) El sDAI solo sale por el router de la estrategia, y nunca más que el tope.** `pull` solo lo puede llamar el `app` con el que se publicó la estrategia (el router de OddsFlow), y resta del saldo virtual con aritmética comprobada: si no alcanza, revierte.

**c) El precio y la dirección los fija el programa, no el taker.** `FixedPriceSwap` calcula `amountOut` a partir de `amountIn` con el precio que el apostador puso en el programa, redondeando a su favor, y revierte si la dirección no es token de resultado → sDAI. El programa es inmutable: cambiarlo es otro `strategyHash`, o sea, otra orden.

**d) El token que recibe llega en la misma transacción, o no pasa nada.** En `v1.0.2`, después de sacar el sDAI del maker, el router exige que el saldo virtual del token de entrada haya subido en `amountIn`: si no, revierte con `AquaBalanceInsufficientAfterTakerPush`. Y `push` en Aqua transfiere ese token directo a la wallet del maker. Además, `safeBalances` revierte si el token no es de la estrategia, así que solo el token exacto de ese mercado y lado sirve (regla 6 del [04](./04_diseno-de-solucion.md#6-reglas-de-negocio)).

**e) Nada con el mercado resuelto ni después del vencimiento.** `OnlyUnresolvedCondition` revierte si `payoutDenominator(conditionId) > 0`; `Deadline` revierte pasado el vencimiento. Van antes de `FixedPriceSwap` en el programa, así que también cortan el `quote`.

**Cómo se verifica.** Pruebas de contratos sobre un fork de Gnosis que intentan lo prohibido y esperan que falle:

- `FixedPriceSwap`: fuzz de montos y precios — el maker nunca paga más de `precio` por token, en exact-in y en exact-out.
- Dirección contraria (sDAI → token de resultado): revierte en `quote` y en `swap`.
- Token de otro mercado u otro lado: revierte.
- Llenado que excede el tope restante: revierte.
- Taker que no entrega el token: revierte con `AquaBalanceInsufficientAfterTakerPush`.
- Después del vencimiento, y con la condición resuelta: revierte.
- `ship`/`dock` en nombre de otro: imposible por construcción; se prueba que la orden de un maker no se puede cancelar desde otra cuenta.
- `OddsFlowTaker` termina toda transacción con saldo cero de todos los tokens.
- Además, el programa corre contra `CoreInvariants` de SwapVM (el arnés de invariantes del propio repo), porque un programa que rompe la simetría entre exact-in y exact-out se comporta raro con cualquier taker.

---

## 6. El cálculo central: el precio fijo y el reparto en una compra

**`FixedPriceSwap`.** El precio `p` es sDAI por token de resultado, en base 10¹⁸ (sDAI y los tokens de Seer tienen 18 decimales). El taker entrega tokens de resultado y recibe sDAI del maker:

- Exact-in (el taker fija cuántos tokens entrega, `n`): `amountOut = ⌊n × p / 10¹⁸⌋`.
- Exact-out (el taker fija cuánto sDAI quiere, `s`): `amountIn = ⌈s × 10¹⁸ / p⌉`.

Los dos redondeos favorecen al maker. Los registros de saldo que SwapVM trae de Aqua no se usan para el precio: el tope lo hace cumplir `pull`.

**Compra con creación de tokens (`OddsFlowTaker`).** La contraparte quiere `N` tokens del lado NO, con un mínimo aceptable. Para cada orden de SÍ, de mayor a menor precio (el NO más barato primero):

1. `n = min(lo que falta, lo que la orden puede cubrir hoy / p)`. Si `n` es 0, se salta la orden: nunca se llama a un `swap` que va a revertir.
2. `swap` exact-in de `n` tokens SÍ. El router saca `m = ⌊n × p⌋` sDAI del maker hacia `OddsFlowTaker`.
3. En `preTransferInCallback`, `OddsFlowTaker` toma `n − m` sDAI de la contraparte, hace `splitPosition(sDAI, market, n)` en el Router de Seer y recibe `n` SÍ, `n` NO y `n` inválido. Hace `push` de los `n` SÍ a la estrategia; Aqua se los transfiere al maker.
4. Reparte los inválidos según el aporte: `m` al maker, `n − m` a la contraparte. Los `n` NO van a la contraparte.

Al final exige que la contraparte haya recibido al menos su mínimo; si no, revierte todo.

**Cuántas órdenes recorre una compra: hasta 10.** Medido en un fork de Gnosis el 26 de septiembre (`GasForkTest`): 909 k de gas con 1 orden, 2,13 M con 3, 3,36 M con 5 y 6,42 M con 10; cada orden suma ~610 k, casi todo del split en Seer. Con el gas de Gnosis a 0,006 gwei y ETH a ~$2 680, recorrer 10 órdenes cuesta unos $0,10. La web manda como mucho 10.

---

## 7. Autenticación y permisos

No hay cuentas ni sesiones: la identidad es la wallet, y los permisos viven en los contratos.

| Quién | Puede | No puede |
| --- | --- | --- |
| **Apostador** | `approve` sDAI a Aqua; `ship` y `dock` de sus propias estrategias; `redeemPositions` en Seer | Tocar estrategias de otro maker |
| **Contraparte / vendedor** | Llamar al router o a `OddsFlowTaker` para llenar órdenes, dentro de lo que el programa acepta | Cambiar el precio, la dirección, el tope o el vencimiento de una orden |
| **Router de OddsFlow** | `pull` y `push` sobre estrategias publicadas para él | Mover fondos de estrategias publicadas para otro `app`; salirse del programa de la orden |
| **`OddsFlowTaker`** | Usar, dentro de una transacción, el sDAI que la contraparte le aprobó | Retener fondos entre transacciones; tocar el sDAI de un apostador, sobre el que no tiene aprobación |
| **Dueño del router** (`Rescuable` de SwapVM) | Nadie: la propiedad se renuncia al desplegar (§11) | — |

---

## 8. Trabajos automáticos

Ninguno. No hay keeper, cron ni bot: una orden vence sola por `Deadline`, se llena cuando una contraparte firma, y se cobra cuando el apostador lo pide. Un taker automático para la demo sería trampa: la demo muestra a una contraparte comprando desde la web.

---

## 9. Costos

Para el hackathon y la demo; no hay modelo de negocio en esta versión.

| Concepto | Costo | Nota |
| --- | --- | --- |
| Gas en Gnosis | Centavos de dólar | Precio de gas de ~0,006 gwei el 2026-09-26. Desplegar el router y `OddsFlowTaker` es la partida más grande, y aun así es una fracción de dólar |
| sDAI para la demo | Algunos dólares, recuperables | Dinero real: el del apostador y el de la contraparte de la demo. Se recupera al cobrar o con `merge` |
| Crear el mercado de la demo | Gas, más el bond de Reality.eth para responder | El bond vuelve al que respondió bien. Monto mínimo en Gnosis por confirmar (§11) |
| RPC de Gnosis | 0 | Plan gratuito de cualquier proveedor; `eth_getLogs` desde el bloque de despliegue |
| Hosting de la web | 0 | Estática o capa gratuita de cualquier proveedor ([06](./06_tecnologias.md)) |

---

## 10. Riesgos técnicos

Ordenados por cuánto daño hacen si se materializan.

| Riesgo | Qué pasa | Qué se hace |
| --- | --- | --- |
| **Un error en `FixedPriceSwap` o en `OddsFlowTaker` con dinero real** | Un apostador paga más de lo firmado o pierde fondos | Las pruebas de §5 antes de desplegar, `CoreInvariants`, y la demo con montos chicos y wallets dedicadas |
| **El router redesplegado no se comporta como el oficial** | Las órdenes no se llenan | Compuerta del día 1 ([03](./03_bounties.md#pendientes)). Plan B: la misma lógica vía `Extruction` en el router oficial |
| **1inch valora menos un router redesplegado** | Menos puntaje en el track | Preguntar a los mentores el primer día ([feedback](../feedback/01_1inch.md#preguntas-abiertas-para-los-mentores)). El plan B de arriba también responde a esto |
| **El flujo `preTransferInCallback` no admite el split dentro** (reentrada, orden de pasos) | No hay camino de creación; solo venta | Se prueba en la compuerta. Alternativa: `isFirstTransferFromTaker` con el sDAI de la contraparte adelantado, o un flash de sDAI |
| **Resolver el mercado de la demo tarda** (timeout de Reality.eth) | La demo no llega a "cobrar" en vivo | El mercado se crea con la apertura y el timeout mínimos que permita Seer, días antes de la demo. Si no alcanza, el cobro se muestra en el fork |
| **La wallet no admite `wallet_sendCalls`** | Publicar N órdenes pide N confirmaciones | Caída a transacciones en serie; la demo usa una wallet que sí lo admite |
| **Límites de `eth_getLogs` del RPC** | El libro de órdenes no carga | Leer desde el bloque de despliegue del router, en tramos |
| **Tiempo** | Lo de siempre | El [07](./07_plan-de-trabajo.md) recorta desde atrás: primero el recorrido de varias órdenes, luego el camino de venta; nunca las pruebas de §5 |

---

## 11. Pendientes

- ~~**Dueño del router.**~~ `Ownable` no acepta la dirección cero, así que `Deploy.s.sol` despliega con la cuenta `deployer` como dueña y llama a `renounceOwnership()` en la misma ejecución: nadie puede usar `rescueFunds`.
- ~~**Bond mínimo y timeout de Reality.eth en Gnosis**~~ Bond mínimo 0,0005 ETH (el que usa la app de Seer en Gnosis); timeout de 302 400 s (3,5 días), fijado por `MarketFactory.questionTimeout()`.
- **Aprobación de la contraparte.** Si sDAI en Gnosis admite `permit` (EIP-2612), la primera compra también es una sola firma; si no, es `approve` + compra, agrupadas con `wallet_sendCalls`.
- ~~**Máximo de órdenes por compra** (§6), a medir.~~ 10.
- Confirmar con 1inch las preguntas del [feedback](../feedback/01_1inch.md#preguntas-abiertas-para-los-mentores).

**Direcciones en Gnosis** (fijadas en `packages/core/src/addresses.ts`):

| Contrato | Dirección |
| --- | --- |
| Aqua (oficial) | `0x1111113ccf1426a8e30e2bff5e005d929bf6a90a` |
| sDAI (colateral) | `0xaf204776c7245bF4147c2612BF6e5972Ee483701` |
| Seer `MarketFactory` | `0x83183DA839Ce8228E31Ae41222EaD9EDBb5cDcf1` |
| Seer `GnosisRouter` | `0xeC9048b59b3467415b1a38F63416407eA0c70fB8` |
| Seer `MarketView` | `0x95493F3e3F151eD9ee9338a4Fc1f49c00890F59C` |
| Seer `RealityProxy` | `0xc260ADfAC11f97c001dC143d2a4F45b98e0f2D6C` |
| Conditional Tokens | `0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce` |
| Reality.eth | `0xE78996A233895bE74a66F451f1019cA9734205cc` |
| Router SwapVM oficial (referencia, no se usa) | `0x111111338c5091e8440b67b168bae16a668ac0de` |
| Router SwapVM de OddsFlow | `0xB8747B3e2F90154420165FB2fc4707D638797140` (bloque 48438501) |
| `OddsFlowTaker` | `0xdD026eA05C9256A1162dC3d41102579458A804Cd` |

Los mismos dos contratos existen en Base en las mismas direcciones (la cuenta de despliegue tenía nonce 0 en ambas redes), desplegados antes de la mudanza y sin uso.
