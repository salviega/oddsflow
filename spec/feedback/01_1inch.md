# 01 — Feedback: 1inch (Aqua / SwapVM)

> **Alcance de este documento:** bitácora viva de lo que 1inch documenta o promete sobre Aqua y SwapVM, frente a lo que encontramos al construir OddsFlow. Se actualiza el día que algo aparece, no al final.
> **Depende de:** [03 — Bounties §1](../definicion/03_bounties.md#1-1inch--build-an-aqua-app) · [05 — Stack y arquitectura](../definicion/05_stack-y-arquitectura.md)

Stack en uso: contratos oficiales en Base mainnet — Aqua `0x1111113ccf1426a8e30e2bff5e005d929bf6a90a` y router SwapVM `0x111111338c5091e8440b67b168bae16a668ac0de` (dominio EIP-712 "1inch SwapVM v1.0", versión `1.0.2`). Fuentes leídas: `1inch/swap-vm` en el tag `v1.0.2` y en `main`, `1inch/aqua` en `main`, y el README de `@1inch/swap-vm-sdk` en `1inch/sdks`. Todavía sin código propio: las entradas de hoy salen de la fase de definición.

---

## Lo que funcionó bien

- **`Extruction` está documentada como se debe documentar un punto de extensión.** La natspec de `contracts/instructions/Extruction.sol` dice qué puede tocar el contrato externo (registros, contador de programa, argumentos del taker), qué guardas debe poner el maker antes de llamarlo, y que en modo `swap` puede escribir estado mientras en `quote` solo lee. Con eso se diseñó la orden a precio fijo sin tener que adivinar.
- **Aqua se entiende leyendo el código.** `pull` y `push` en `src/Aqua.sol` son diez líneas cada una y responden solas las dos preguntas de diseño que teníamos (ver la bitácora del 2026-09-26).
- **El evento `Shipped` trae el programa completo.** Aqua no tiene una función que liste las estrategias de un maker, pero `Shipped(maker, app, strategyHash, strategy)` emite los bytes del programa, así que un libro de órdenes se puede reconstruir desde la cadena sin backend de confianza.
- **Direcciones iguales en todas las redes.** Una sola constante para Aqua y otra para el router.

---

## Bitácora

### 2026-09-26 — No hay despliegue oficial en testnet, y no se dice

**Documentado / prometido:** los READMEs de `1inch/aqua` y `1inch/swap-vm` listan las redes con despliegue oficial: Ethereum, Base, Optimism, Polygon, Arbitrum, Avalanche, BNB Chain, Linea, Sonic, Unichain, Gnosis, zkSync, Cronos, Monad, HyperEVM (y Robinhood en Aqua).

**Encontrado:** ninguna es testnet, y ninguno de los dos READMEs lo dice explícitamente. El track pide "usar los contratos oficiales" y acepta forks locales, pero quien empieza buscando Base Sepolia o Sepolia tarda en convencerse de que no existen.

**Evidencia:** sección de despliegues de `1inch/aqua/README.md` y sección "Deployment" de `1inch/swap-vm/README.md` (línea 233 en `main`).

**Impacto en el proyecto:** decidió la red. Descartamos Base Sepolia (habría que redesplegar Aqua, SwapVM y además Seer) y fuimos a Base mainnet, con tests sobre fork. Ver [03 §Marco](../definicion/03_bounties.md#marco).

**Reportado:** pendiente. Sugerencia: una línea en ambos READMEs — "no official testnet deployments; use a mainnet fork" — con el comando de fork recomendado.

### 2026-09-26 — La dirección oficial del router no dice qué router es, y no tiene `LimitSwap`

**Documentado / prometido:** el README de SwapVM describe tres routers (`SwapVMRouter` con el set completo, `LimitSwapVMRouter` con `LimitSwap*` e invalidadores, `AquaSwapVMRouter` con el subconjunto de Aqua) y, más abajo, da **una** dirección: "Release v1.0.x router: `0x111111338c…`". El README de Aqua la llama simplemente "SwapVM router".

**Encontrado:** es el `AquaSwapVMRouter`. Solo despacha `AquaOpcodes`: curvas AMM, `Decay`, `Deadline`, saltos, validadores de balance, comisiones, `Salt` y `Extruction`. **No tiene `LimitSwap`, `StaticBalances`, invalidadores ni `RequireMinRate`**, así que una orden límite a precio fijo no se puede escribir con instrucciones de fábrica. Lo dice un único lugar: el README del SDK de TypeScript ("The currently deployed `AquaSwapVMRouter` contracts support only the Aqua subset…"). Ni el README de los contratos ni el `eip712Domain()` onchain ("1inch SwapVM v1.0") lo distinguen. Además, la tabla de routers del README resume el alcance del `AquaSwapVMRouter` como "AMM curves, `Decay`, `FeeFlatIn`, `FeeProtocol`, guards" y omite `Extruction`, que es justo la salida cuando falta una instrucción.

**Evidencia:**
- `cast call 0x111111338c5091E8440b67B168bAe16a668AC0De 'eip712Domain()(bytes1,string,string,uint256,address,bytes32,uint256[])' --rpc-url https://mainnet.base.org` → `"1inch SwapVM v1.0"`, `"1.0.2"`, `8453`.
- `contracts/opcodes/AquaOpcodes.sol` (`_runOpcode`) frente a `contracts/opcodes/Opcodes.sol`.
- `1inch/sdks/typescript/swap-vm/README.md`, sección "Instruction coverage vs. deployment".
- `1inch/swap-vm/README.md`, tabla "Routers" (líneas 75-79 en `main`).

**Impacto en el proyecto:** cambió el diseño de la orden: hace falta un opcode propio de precio fijo (ver la entrada siguiente). Ver [03 §1](../definicion/03_bounties.md#1-1inch--build-an-aqua-app) y [04 §8](../definicion/04_diseno-de-solucion.md#8-decisiones-tomadas-y-pendientes).

**Reportado:** pendiente. Sugerencia: en la sección "Deployment" del README de SwapVM, decir que la dirección oficial es un `AquaSwapVMRouter` y enlazar la lista de `aquaInstructions`; en la tabla de routers, incluir `Extruction` en el alcance del de Aqua.

### 2026-09-26 — `LimitSwap` no daría precio fijo sobre Aqua aunque el router lo despachara

**Documentado / prometido:** el README de SwapVM presenta `LimitSwap` como la instrucción de órdenes límite, y el de Aqua presenta Aqua como la capa de liquidez sobre la que corren las estrategias de SwapVM. Nada indica que las dos no se combinen.

**Encontrado:** `LimitSwap` no guarda un precio: lo deduce de los registros de saldo, `amountOut = amountIn × balanceOut / balanceIn`, y exige `balanceIn > 0 && balanceOut > 0`. En una estrategia de Aqua esos registros son los saldos virtuales vivos. Una orden de compra recién publicada (1.000 sUSDS, 0 del token que quiere) revierte con `LimitSwapRequiresBothBalancesNonZero`, y si arrancara, cada llenado sumaría de un lado y restaría del otro, moviendo el precio: una curva, no una orden límite. `LimitSwap` está pensado para `StaticBalances` en órdenes firmadas. Así que la ausencia de `LimitSwap` en `AquaOpcodes` no es un olvido que se arregle despachándolo: **Aqua no tiene hoy ninguna forma de expresar una orden a precio fijo.**

**Evidencia:** `src/instructions/LimitSwap.sol` en `v1.0.2`, función `_limitSwap1D`; `src/Aqua.sol`, `push` y `pull` (los saldos que ven los registros cambian en cada llenado).

**Impacto en el proyecto:** OddsFlow define un opcode nuevo, `FixedPriceSwap`, con el precio como argumento de la instrucción y redondeo a favor del maker, en un `AquaSwapVMRouter` redesplegado sobre el Aqua oficial. Ver [03 §1](../definicion/03_bounties.md#1-1inch--build-an-aqua-app).

**Reportado:** pendiente. Plan: PR a `1inch/swap-vm` proponiendo `FixedPriceSwap` para `AquaOpcodes`, con sus tests, cuando la fase de contratos del [07](../definicion/07_plan-de-trabajo.md) lo tenga verificado.

### 2026-09-26 — El código de `main` no es lo que está desplegado

**Documentado / prometido:** el README de SwapVM lo advierte en dos líneas: el router desplegado "exposes the v1.0 ABI, `swap(order, tokenIn, tokenOut, amount, takerData)`", mientras que "`main` uses `swap(order, amount, takerTraitsAndData)`".

**Encontrado:** la advertencia es correcta pero fácil de pasar por alto, y la diferencia no es solo la firma: en `main` los fuentes están en `contracts/`, en `v1.0.2` en `src/`. Quien compila contra `main` (lo que hace `forge install` sin tag si la rama por defecto avanza) obtiene un ABI que el router de Base rechaza.

**Evidencia:** `1inch/swap-vm/README.md` líneas 233-235 en `main`; árbol de `v1.0.2` (`src/routers/AquaSwapVMRouter.sol`) frente a `main` (`contracts/routers/AquaSwapVMRouter.sol`).

**Impacto en el proyecto:** ninguno todavía: lo vimos antes de escribir código. Decisión para el [05](../definicion/05_stack-y-arquitectura.md): fijar `1inch/swap-vm` al tag `v1.0.2`.

**Reportado:** pendiente. Sugerencia: que el README de `main` indique el tag exacto que corresponde a la dirección desplegada.

### 2026-09-26 — Lo que funcionó: `pull` y `push` de Aqua responden el diseño solos

**Encontrado:** `src/Aqua.sol` confirma dos cosas que el README solo sugería. `pull` resta del saldo virtual con aritmética comprobada, así que **revierte si la estrategia no tiene saldo**: el tope por orden lo hace cumplir Aqua sin código nuestro. `push` hace `safeTransferFrom(msg.sender, maker, amount)`: **los tokens que entrega el taker llegan directo a la wallet del maker**, no quedan en Aqua. Con eso, "el apostador recibe sus tokens en la misma transacción" no necesita un paso extra.

**Evidencia:** `1inch/aqua/src/Aqua.sol`, funciones `pull` (línea 83) y `push` (línea 92) en `main`.

---

## Preguntas abiertas para los mentores

- [ ] ¿Puntúa más un opcode nuevo (`FixedPriceSwap`) en un `AquaSwapVMRouter` redesplegado sobre el Aqua oficial, que la misma lógica vía `Extruction` en el router oficial?
- [ ] ¿Les interesa `FixedPriceSwap` como PR para `AquaOpcodes`?
- [ ] ¿Operar sobre mercados de Seer cumple con "posición DeFi sofisticada", o esperan que la lógica del mercado viva en la app? (Pendiente del [03](../definicion/03_bounties.md#pendientes).)
- [ ] ¿Qué incluyen los otros $2.000 del premio total de 1inch ($7.000), además de este track?

---

## Resumen

| # | Área | Se documentaba | Se encontró | Severidad | Reportado |
| - | ---- | --------------- | ----------- | --------- | --------- |
| 1 | Despliegues | Lista de redes oficiales | Ninguna es testnet, sin decirlo | Media: decidió la red | Pendiente |
| 2 | Router | Tres routers y una dirección | La dirección es el de Aqua, sin `LimitSwap`; solo el SDK lo aclara | Alta: cambió el diseño de la orden | Pendiente |
| 3 | Instrucciones | `LimitSwap` para órdenes límite | Deduce el precio de los saldos: sobre Aqua revierte o se mueve; no hay precio fijo posible | Alta: obligó a un opcode propio | PR pendiente |
| 4 | Versionado | `main` ≠ ABI desplegado | Cambia también el layout (`contracts/` vs `src/`) | Nota | Pendiente |

## Reportes abiertos (se llena en la fase de demo)

- [ ] —
