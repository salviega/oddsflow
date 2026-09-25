# 06 — Tecnologías del stack

> **Alcance de este documento:** el inventario concreto — qué se instala, para qué sirve cada pieza y qué se descartó.
> **Depende de:** [05 — Stack y arquitectura](./05_stack-y-arquitectura.md)
> ⚠️ Las versiones son la referencia al momento de escribir (**26 de septiembre de 2026**, consultadas en npm, en los tags de GitHub y en el binario local). **Confirmar la estable vigente al instalar**; lo que no debe cambiar es la elección, no el número. La excepción son los contratos de 1inch: ahí el número **sí** es la elección.

---

## 1. Base

| Tecnología | Versión | Para qué |
| --- | --- | --- |
| **Node.js** | 22 LTS | Runtime de la web (build) y de los scripts. Fijado en `.nvmrc` y en `engines` |
| **TypeScript** | 5.9 | `strict: true`. Sin `any` en `packages/core`. La 7.x existe en npm, pero Next 16 declara 5.x |
| **pnpm** | 12.3 | Workspaces del monorepo. Lockfile estricto. Desde la 12 bloquea build scripts y paquetes publicados hace muy poco; ambos se configuran en `pnpm-workspace.yaml` |
| **Foundry** | 1.3.2 | Compilar, probar y desplegar contratos: `forge`, `cast`, `anvil`. **Fijado también en CI**: `forge fmt` cambia entre versiones y el hook local tiene que coincidir con CI |

Workspaces de pnpm y no Turborepo: con dos paquetes y una app, `pnpm -r` alcanza.

---

## 2. Contratos y cadena

| Tecnología | Versión | Para qué |
| --- | --- | --- |
| **Solidity** | 0.8.30, via-IR, optimizer 700 | Los mismos ajustes que el `foundry.toml` de SwapVM `v1.0.2`, para que nuestro router se compile igual que el oficial salvo por los dos opcodes |
| **`1inch/swap-vm`** | **tag `v1.0.2`** (git) | `AquaSwapVMRouter`, `AquaOpcodes`, la librería `Deadline`, `ITakerCallbacks` y `CoreInvariants` para las pruebas. Es el ABI desplegado ([05 §1](./05_stack-y-arquitectura.md#1-decisiones)) |
| **`1inch/aqua`** | tag `0.1.0` (git) | `IAqua` y el contrato `Aqua` para las pruebas. Es la versión que declara el `package.json` de SwapVM `v1.0.2`, no la última (`v1.0.0`) |
| **OpenZeppelin Contracts** | 5.4.0 (git) | Dependencia de SwapVM y Aqua. Se trae con `forge install` y se remapea |
| **`1inch/solidity-utils`** | 6.9.7 (git) | Dependencia de SwapVM (`Calldata`, `Simulator`, `SafeERC20`). La versión exacta que fija SwapVM `v1.0.2` |
| **Interfaces de Seer** | escritas a mano | `Router.splitPosition`, `Market` (`conditionId`, `wrappedOutcome`, `questionsIds`), `IConditionalTokens.payoutDenominator`, `IRealityETH.getOpeningTS`. Pocas funciones: no vale traer el repo de Seer |
| **viem** | 2.56 | Lectura y escritura de cadena desde TypeScript: `packages/core` y la web |
| **`@1inch/swap-vm-sdk`** | 0.4 | `ProgramBuilder` con **nuestra** tabla de opcodes (`ixsSet`): codificar y decodificar el programa de una orden. El SDK lo admite de forma explícita para routers propios |
| **`@1inch/aqua-sdk`** | 0.3 | Codificar `ship`/`dock` y parsear `Shipped`, `Docked`, `Pulled`, `Pushed` sin escribir ABIs a mano |

**Por qué Foundry.** SwapVM y Aqua están hechos con Foundry, y **no están publicados en npm** pese a los badges de sus READMEs: `npm view @1inch/swap-vm` y `npm view @1inch/aqua` no devuelven nada (verificado el 26 de septiembre; ver [feedback](../feedback/01_1inch.md)). Con `forge install` se traen en el tag exacto, se compilan en el mismo árbol, y `CoreInvariants` se hereda tal cual. Hay que remapear a mano OpenZeppelin y `solidity-utils`, porque sus `remappings.txt` apuntan a `node_modules/`. `forge coverage` necesita `--ir-minimum` con via-IR.

**Anvil** corre el fork de Base para las pruebas (`anvil --fork-url $BASE_RPC_URL`, o `forge test --fork-url`). La demo va en Base real.

---

## 3. Interfaz

| Tecnología | Versión | Para qué |
| --- | --- | --- |
| **Next.js** | 16.3 | La web. App Router. Casi todo es cliente: sin backend, las rutas de servidor no se usan |
| **React** | 19.3 | Viene con Next |
| **wagmi** | 3.7 | Conexión de wallet, lectura con caché y escritura. `useSendCalls` para publicar varias órdenes en una confirmación (EIP-5792) |
| **TanStack Query** | 5.x | Lo usa wagmi por debajo; también para el libro de órdenes (logs de Aqua) y su refresco |
| **Tailwind CSS** | 4.3 | Estilos. Configuración por CSS, tokens en `globals.css` |
| **Barlow** (`next/font/google`) | 400 · 500 · 600 | La tipografía de la marca ([09 §4](./09_marca-y-seo.md#4-tipografía)). Se sirve desde el propio dominio, sin salto de diseño |
| **lucide-react** | 1.48 | Iconos. Los componentes son funciones propias en `apps/web/src/components/`; no hace falta una librería de componentes para cinco pantallas |

**Conectar la wallet sin kit.** Los conectores de wagmi (`injected` y `baseAccount`) más un botón propio. Base Account es la que asegura `wallet_sendCalls` atómico en la demo ([05 §10](./05_stack-y-arquitectura.md#10-riesgos-técnicos)).

---

## 4. Formularios y validación

| Tecnología | Versión | Para qué |
| --- | --- | --- |
| **zod** | 4.x | Un esquema por cosa que cruza una frontera: parámetros de una orden (precio 0.01–0.99, tope, vencimiento ≤ apertura), programa decodificado del libro, variables de entorno. Vive en `packages/core` |

Los esquemas son la fuente de los tipos. Un programa leído de un evento `Shipped` que no valida (otro router, otros opcodes, otro mercado) **no entra al libro**: la web no muestra órdenes que no entiende.

Formularios con estado de React y `useActionState`; sin librería de formularios. Son dos: nuevas órdenes y compra.

---

## 5. Desarrollo y calidad

| Tecnología | Versión | Para qué |
| --- | --- | --- |
| **Biome** | 2.5 | Lint y formato de TypeScript en un solo binario. Script `check` |
| **Vitest** | 5.0 | Pruebas de `packages/core`: construir y decodificar programas, estado derivado de una orden, recorrido de órdenes de una compra, esquemas |
| **`@vitest/coverage-v8`** | 5.0 | Cubrimiento de Vitest. `pnpm test` corre con `--coverage`; el umbral vive en `vitest.config.ts` |
| **`forge coverage`** | — | Cubrimiento de contratos, con el piso de 90 % aplicado por `scripts/check-coverage.mjs` |
| **`forge test`** | — | Pruebas de contratos sobre fork de Base, incluidas las de "lo prohibido debe fallar" del [05 §5](./05_stack-y-arquitectura.md#5-la-regla-que-no-puede-fallar-el-susds-del-apostador-nunca-sale-sin-sus-tokens-al-precio-que-firmó) y `CoreInvariants` |
| **`forge fmt`** | — | Formato de Solidity |
| **GitHub Actions** | — | En cada PR: `pnpm check`, `pnpm test`, `forge fmt --check`, `forge test` con fork de Base, build de la web |
| **`.githooks`** | — | `commit-msg` (Conventional Commits) ya existe. Se agrega pre-commit: `pnpm check` y `forge fmt --check` |

**Una prueba que vale por dos.** `packages/core` construye el programa de una orden y calcula su `strategyHash`; una prueba de Foundry construye el mismo programa en Solidity y compara. Si divergen, la web estaría publicando una orden y mostrando otra.

**Cubrimiento: 90 % o más en `packages/core` y en `packages/contracts/src`.** Pruebas unitarias; escribirlas antes o después del código queda a criterio de quien lo escribe. En `packages/core`, `vitest.config.ts` declara `coverage.thresholds`, así que `pnpm test` falla solo bajo el piso. En contratos, Foundry no tiene umbral propio: `pnpm coverage:contracts` corre `forge coverage --ir-minimum` y `scripts/check-coverage.mjs` falla si la fila *Total* baja de 90 % en líneas, sentencias, ramas o funciones. El piso no reemplaza a las pruebas nombradas del [05 §5](./05_stack-y-arquitectura.md#5-la-regla-que-no-puede-fallar-el-susds-del-apostador-nunca-sale-sin-sus-tokens-al-precio-que-firmó): las dos cosas son obligatorias.

**`require` con error personalizado no se mide bien con `--ir-minimum`.** Foundry no instrumenta esas ramas (ni siquiera el camino que pasa): con `require(cond, Error())` en los opcodes, las ramas daban 41,67 % con todas las pruebas de reversión en verde. Con `if (!cond) revert Error();` dan 100 %. En `packages/contracts/src` se escribe así.

---

## 6. Servicios externos

| Servicio | Plan | Para qué |
| --- | --- | --- |
| **RPC de Base** (Alchemy u otro) | Gratuito | Fork de pruebas, CI y la web. El RPC público (`mainnet.base.org`) sirve para lecturas sueltas, pero limita `eth_getLogs` |
| **Vercel** | Hobby | Hosting de la web |
| **Etherscan API v2** (Basescan) | Gratuito | Verificar el router y `OddsFlowTaker` con `forge verify-contract` |
| **Sourcify** | Gratuito | Segunda verificación, con coincidencia exacta de bytecode y metadata |
| **GitHub Actions** | Gratuito (repo público) | CI en cada PR |

---

## 7. Variables de entorno

| Variable | Dónde se usa | Notas |
| --- | --- | --- |
| `BASE_RPC_URL` | `packages/contracts` (fork y despliegue), CI | Sensible si lleva API key. Secreto de GitHub en CI |
| `NEXT_PUBLIC_BASE_RPC_URL` | `apps/web` | Pública por definición: usar una key restringida por dominio |
| `ETHERSCAN_API_KEY` | `packages/contracts` (verificación) | Sensible |
| `NEXT_PUBLIC_SITE_URL` | `apps/web/src/lib/site.ts` (canonical, Open Graph, sitemap) | Pública. Sin ella, `https://oddsflow.vercel.app` ([09 §10](./09_marca-y-seo.md#10-pendientes)) |

**La llave de despliegue no vive en `.env`.** Se importa una sola vez con `cast wallet import deployer --interactive` al keystore cifrado de Foundry, y los scripts usan `--account deployer`. Es dinero real en Base.

**Las direcciones no son variables de entorno.** Las de Base (Aqua, sUSDS, Seer, Reality.eth, nuestro router y `OddsFlowTaker`) y el bloque de despliegue del router viven en `packages/core/src/addresses.ts`, versionadas: cambiar una dirección es un commit, no un ajuste de hosting.

---

## 8. Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` | La web en local, contra Base |
| `pnpm check` | Biome: lint y formato |
| `pnpm typecheck` | `tsc --noEmit` en todos los paquetes |
| `pnpm test` | Vitest con `--coverage`; falla si `packages/core` baja del 90 % |
| `pnpm test:contracts` | `forge test --fork-url $BASE_RPC_URL` |
| `pnpm coverage:contracts` | `forge coverage` sobre el fork; falla si `packages/contracts/src` baja de 90 % |
| `pnpm build` | Build de la web |
| `pnpm deploy:base` | `forge script` del router y `OddsFlowTaker` en Base, con `--account deployer --verify`, y escribe las direcciones en `packages/core` |
| `pnpm demo:market` | Crea el mercado binario de la demo en Seer (`MarketFactory`) e imprime sus tokens y su `conditionId` |

---

## 9. Lo que se descartó y por qué

| Descartado | En favor de | Por qué |
| --- | --- | --- |
| Hardhat | Foundry | SwapVM y Aqua no están en npm y están hechos con Foundry; `CoreInvariants` se hereda directo |
| `1inch/swap-vm` en `main` | Tag `v1.0.2` | `main` cambió el ABI de `swap` y el layout de fuentes; el router desplegado es `v1.0.2` |
| `1inch/aqua` `v1.0.0` | Tag `0.1.0` | Es la que declara SwapVM `v1.0.2`. Queda por confirmar que la interfaz coincide con el Aqua desplegado en Base (§10) |
| RainbowKit / ConnectKit | Conectores de wagmi + botón propio | Los dos piden wagmi 2 como peer; wagmi 3 trae `useSendCalls` estable. Un botón de conectar no justifica fijar una versión vieja |
| Subgraph | `eth_getLogs` desde `packages/core` | Un solo router nuevo: los logs desde su bloque de despliegue caben en pocas llamadas. Un subgraph es otro servicio y otro dato que puede mentir |
| Llave en `.env` | Keystore cifrado de Foundry | Es la llave que despliega en mainnet |
| Librería de componentes (shadcn/ui) | Componentes propios | Cinco pantallas; el costo de adaptarla supera el de escribirlos |

---

## 10. Pendientes

- ~~**Aqua desplegado en Base vs. tag `0.1.0`.**~~ Coinciden: `ship`, `rawBalances`, `safeBalances`, `pull` y `push` del Aqua oficial funcionan con la interfaz del tag en `GateForkTest` (26 de septiembre).
- **`@1inch/swap-vm-sdk` 0.4 y el ABI `v1.0`.** Confirmar que codifica `Order` y `takerTraits` para el ABI desplegado y no para el de `main`. Si no, `packages/core` codifica el programa con su propia tabla, que igual hace falta para los dos opcodes nuevos.
- **`permit` en sUSDS de Base** (compartido con el [05 §11](./05_stack-y-arquitectura.md#11-pendientes)): decide si la primera compra es una firma o dos llamadas agrupadas.
