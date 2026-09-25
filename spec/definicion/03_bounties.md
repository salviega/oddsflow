# 03 — Bounties

> **Alcance de este documento:** a qué premios se presenta el proyecto, qué exige cada uno y qué obliga eso a construir. **No define diseño ni stack**, pero condiciona a los dos.
> **Depende de:** [02 — Solución](./02_solucion.md)

---

## Marco

El proyecto se presenta a **1 bounty**, y cae sobre la pieza central del producto descrito en el [02](./02_solucion.md):

| Pieza del [02](./02_solucion.md)                                                                                                    | Bounty                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Órdenes a precio fijo que no bloquean capital, respaldadas por un mismo saldo, y su ejecución dentro de la compra de la contraparte | **1inch — Build an Aqua App** |

**Bolsa total a la que se aplica:** $5.000.

Los mercados no se construyen: se usan los de **Seer**, que no es sponsor del hackathon. Su documentación está en [seer-3.gitbook.io/seer-documentation](https://seer-3.gitbook.io/seer-documentation).

**Red: Base mainnet.** Aqua no tiene testnets: sus contratos solo existen en mainnets, con la misma dirección en todas (Aqua `0x1111113ccf1426a8e30e2bff5e005d929bf6a90a`, router SwapVM `0x111111338c5091e8440b67b168bae16a668ac0de`). Seer está en Ethereum, Gnosis, Optimism y Base. En las cuatro coinciden los dos; se elige Base por el gas. **El colateral de Seer en Base es sUSDS** (`0x5875eEE11Cf8398102FdAd704C9E96607675467a`, 18 decimales, ERC-4626 de Sky): lo devuelve `MarketFactory.collateralToken()` en Base, verificado el 2026-09-26; la documentación no lo dice. Hay 154 mercados creados en Base (1.590 en Gnosis, con sDAI). El `Router` de Base solo expone `splitPosition`/`mergePositions`/`redeemPositions` en sUSDS, sin variantes que conviertan desde USDC o USDS. Direcciones de Seer en Base: `MarketFactory` `0x886Ef0A78faBbAE942F1dA1791A8ed02a5aF8BC6`, `Router` `0x3124e97ebF4c9592A17d40E54623953Ff3c77a73`, `MarketView` `0x179d8F8c811B8C759c33809dbc6c5ceDc62D05DD`. Los tests corren sobre un fork de Base; la demo, sobre Base real.

---

## 1. 1inch — Build an Aqua App

**Premio:** $5.000 · 1.º $2.500 · 2.º $1.500 · 3.º $1.000.

**Qué es 1inch.** Una red de protocolos descentralizados enfocada en unificar la liquidez de DeFi, conocida por su agregador de DEX lanzado en 2019. **Aqua** es su capa de liquidez compartida: el capital se queda en la wallet del maker y respalda estrategias con balances virtuales. **SwapVM** es la máquina virtual que ejecuta esas estrategias como programas de swap.

**Qué pide el track.** Crear una Aqua App que implemente una posición DeFi sofisticada. Si se usa SwapVM, se pueden modificar sus opcodes y definir instrucciones propias. Las posiciones deben demostrarse con scripts de test o con una UI. **Los proyectos que usen SwapVM puntúan más alto.**

**Requisitos de calificación:**

- Usar los contratos oficiales de Aqua/SwapVM. Se permite redesplegar un SwapVM modificado.
- Mostrar en la demo final la ejecución onchain de transferencias de tokens. Los forks locales son válidos.
- Historial de commits real: nada de entregas en un solo commit el último día.

**Recursos:**

- [SwapVM — contratos](https://github.com/1inch/swap-vm/tree/main)
- [Aqua — contratos](https://github.com/1inch/aqua)
- [Aqua SDK (TypeScript)](https://github.com/1inch/sdks/tree/master/typescript/aqua)

**Qué significa para [Nombre].** Es el producto completo, no una integración añadida. La frase central del [02](./02_solucion.md) ("el mismo saldo respalda todas sus órdenes a la vez") es literalmente lo que hace Aqua. Cada orden del apostador es un programa de SwapVM sobre el par colateral ↔ token de resultado de Seer, y la ejecución ocurre cuando el router de la contraparte la toma. La demo muestra lo que pide el track: una orden llenándose onchain con transferencias reales, y el saldo disponible de las demás órdenes bajando en la misma transacción.

_Pendiente: si las órdenes se expresan solo con las instrucciones existentes de SwapVM, o si se agrega una instrucción propia que verifique en Seer que el mercado no esté resuelto antes de ejecutar. Esto último reemplazaría el vencimiento fijo y sumaría puntos en el criterio de SwapVM._

---

## Track descartado

**Curvegrid — Best Digital Asset Dashboard ($1.000):** pide un dashboard como producto principal: análisis de portafolio, RWA, tesorería o vistas cross-chain. En [Nombre], el panel del apostador (órdenes activas, saldo disponible, posiciones por cobrar) es una pieza secundaria del flujo. Convertirlo en un dashboard competitivo exigiría construir analítica que no resuelve nada del [01](./01_contexto-y-problema.md). Solo se reconsidera si ese panel sale naturalmente completo al final.

---

## Requisitos que atraviesan todos

- Historial de commits distribuido a lo largo del hackathon.
- Demo con transferencias de tokens ejecutadas onchain, en Base mainnet.
- Repositorio público con contratos, tests y README con instrucciones de setup y prueba.

---

## Pendientes

- Confirmar qué incluyen los otros $2.000 del premio total de 1inch ($7.000), además de este track.
- ~~Decidir entre fork de Base y Base Sepolia.~~ Base mainnet: Aqua no tiene testnet y redesplegar Aqua + Seer en Sepolia sería más trabajo que el gas real. Ver el marco.
- Confirmar con los mentores de 1inch si operar sobre mercados de Seer cumple con "posición DeFi sofisticada", o si esperan que la lógica del mercado también viva en la app.
- Instrucción propia de SwapVM: sí o no (ver sección 1).
