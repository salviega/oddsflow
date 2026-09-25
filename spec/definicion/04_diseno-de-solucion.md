# 04 — Diseño de la solución

> **Alcance de este documento:** diseño de producto — actores, flujos, pantallas, modelo de datos y reglas. **No define stack ni arquitectura técnica.**
> **Depende de:** [01 — Contexto y Problema](./01_contexto-y-problema.md) · [02 — Solución](./02_solucion.md) · [03 — Bounties](./03_bounties.md)

---

## 1. Principios de diseño

1. **El dinero no sale de la wallet hasta que hay contraparte.** Crear, mantener o cancelar una orden nunca mueve sDAI. Lo único que mueve dinero es un llenado.
2. **Al precio firmado o nada.** Una orden se llena a su precio o no se llena. No hay "casi", no hay slippage para el apostador.
3. **Una transacción para la contraparte.** Quien compra no aprueba nada extra, no espera a nadie y no sabe que del otro lado hay órdenes de otra persona.
4. **"Disponible" es el saldo real.** El panel nunca muestra la suma de las órdenes como si fuera dinero: muestra cuánto sDAI hay en la wallet y qué órdenes podría cubrir.
5. **Nada se opera con el resultado conocido.** Toda orden muere antes de que la pregunta del mercado abra a respuestas.
6. **Sin operador.** No hay backend que pueda mover fondos, pausar órdenes o elegir quién se llena. Lo que se lee fuera de la cadena (el libro de órdenes) solo sirve para mostrar; la cadena decide.

---

## 2. Actores y qué hace cada uno

| Actor | Identidad / cuenta | Qué hace |
| --- | --- | --- |
| **Apostador** (maker) | Wallet en Gnosis con sDAI | Aprueba sDAI a Aqua una vez, publica órdenes, las cancela, cobra lo que ganó |
| **Contraparte** (taker) | Wallet en Gnosis con sDAI | Compra el lado contrario de un mercado en una sola transacción |
| **Vendedor** (taker) | Wallet en Gnosis con tokens de resultado de Seer | Vende a una orden los tokens que ya tiene, al precio de la orden |
| **Seer** _(externo)_ | Contratos en Gnosis | Tiene los mercados, crea los tokens de resultado a partir del colateral (`splitPosition`) y los canjea tras la resolución (`redeemPositions`) |
| **Reality.eth** _(externo, vía Seer)_ | Oráculo | Resuelve la pregunta de cada mercado. OddsFlow no interviene en la resolución |
| **Aqua** _(externo)_ | Contrato oficial de 1inch en Gnosis | Guarda el saldo virtual de cada orden y mueve los tokens |
| **Router de SwapVM de OddsFlow** | `AquaSwapVMRouter` redesplegado con dos opcodes propios | Ejecuta el programa de cada orden: precio fijo, vencimiento y mercado sin resolver ([03](./03_bounties.md#1-1inch--build-an-aqua-app)). No guarda fondos ni tiene dueño que pueda cambiar las reglas |

No hay un actor "operador" ni "administrador". Ver el principio 6.

---

## 3. Modelo de datos

### Mercado

Lo que OddsFlow necesita saber de un mercado de Seer. No se crea: se lee.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `market` | dirección | Contrato `Market` de Seer en Gnosis |
| `pregunta` | texto | `marketName()` |
| `tokenSi`, `tokenNo` | ERC20 | Outcomes 0 y 1 de Seer |
| `tokenInvalido` | ERC20 | Outcome 2. **Todo mercado binario de Seer tiene un tercer token "resultado inválido"**: el split entrega tres tokens, no dos (verificado en Gnosis) |
| `aperturaRespuestas` | fecha | Momento desde el que Reality.eth acepta respuestas. Límite duro para el vencimiento de cualquier orden |
| `estado` | enum | `abierto` · `en resolución` · `resuelto` |

### Orden

Una orden = una estrategia de Aqua. Se identifica por su `strategyHash`.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `apostador` | dirección | El maker. El sDAI sale de aquí solo al llenarse |
| `mercado` | dirección | Un mercado por orden |
| `lado` | SÍ / NO | Qué token de resultado quiere recibir |
| `precioMax` | decimal 0.01–0.99 | sDAI por token de resultado. Un token ganador vale 1 sDAI |
| `tope` | sDAI | Máximo que esta orden puede gastar en total. Es el saldo virtual de la estrategia en Aqua. Cada orden puede declarar todo el saldo (así funciona el saldo compartido) |
| `llenado` | sDAI | Acumulado ya gastado. Nunca supera `tope` |
| `vencimiento` | fecha | ≤ `aperturaRespuestas` del mercado |
| `estado` | enum | Ver §6 |

### Llenado

Una por cada ejecución. Se reconstruye de los eventos onchain, no se guarda en ningún otro lado.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `orden` | `strategyHash` | |
| `tx` | hash | Evidencia del llenado |
| `via` | creación / venta | Si los tokens se crearon en esa transacción o los vendió alguien que ya los tenía |
| `n` | tokens | Tokens de resultado que recibió el apostador |
| `aporteApostador` | sDAI | `n × precio` |
| `aporteContraparte` | sDAI | `n × (1 − precio)`. Solo en `creación` |

### Posición

No es una entidad guardada: es el saldo de tokens SÍ / NO / inválido de una wallet en cada mercado. Se muestra, no se administra.

---

## 4. Flujos

### 4.1 Apostador: publicar órdenes

1. Conecta su wallet en Gnosis. Ve su saldo de sDAI.
2. **Primera vez:** aprueba sDAI a Aqua. Es la única aprobación que va a firmar nunca.
3. Elige uno o varios mercados. En cada uno: lado, precio máximo y tope. Ejemplo: SÍ a 0.20 en el mercado A con tope 1.000 sDAI, y SÍ a 0.25 en el B con tope 1.000 sDAI, teniendo 1.000 sDAI en la wallet.
4. La pantalla le muestra, antes de firmar: vencimiento de cada orden (por defecto, la apertura de respuestas del mercado), y el aviso del [02](./02_solucion.md#qué-resuelve): si se llenan varias a la vez por más de lo que tiene, las últimas fallan.
5. Publica. Cada orden es una transacción `ship` en Aqua: paga gas, **no mueve sDAI**. Si la wallet admite envíos agrupados, todas las órdenes van en una sola confirmación; si no, una por orden.
6. Las órdenes aparecen como `activa` en su panel.

### 4.2 Contraparte: comprar un lado

1. Entra a un mercado y elige lado (NO, siguiendo el ejemplo) y cuánto quiere gastar.
2. Ve el precio: `1 − precioMax` de las órdenes del lado contrario, empezando por la más barata para ella. Si el apostador puso SÍ a 0.20, el NO le cuesta 0.80. Si una orden no alcanza para todo lo que quiere, la compra sigue con la siguiente, y ve el precio promedio antes de firmar.
3. Fija cuánto es lo mínimo que acepta recibir. Si al ejecutarse no llega a eso (otra compra se le adelantó), no pasa nada.
4. Firma **una** transacción. Por cada orden que toma, en este orden, y si cualquier paso falla se revierte todo:
   1. Aqua entrega el sDAI del apostador: `n × 0.20`.
   2. La contraparte pone el suyo: `n × 0.80`.
   3. Con `n` sDAI juntos, Seer crea `n` SÍ, `n` NO y `n` inválido.
   4. El apostador recibe los `n` SÍ. La contraparte recibe los `n` NO.
   5. Los `n` inválido se reparten en proporción al aporte: 20 % al apostador, 80 % a la contraparte (ver §6).
5. Ejemplo con números: la contraparte quiere 100 NO. Paga 80 sDAI, el apostador aporta 20. Salen 100 SÍ para el apostador, 100 NO para la contraparte, y 20 / 80 inválidos.

### 4.3 Vendedor: vender tokens a una orden

1. Tiene 100 SÍ del mercado A, conseguidos en cualquier lado.
2. Ve que hay una orden que compra SÍ a 0.20 y vende: recibe 20 sDAI del apostador, el apostador recibe sus 100 SÍ. Una transacción, sin crear tokens.
3. Sirve igual desde la interfaz de OddsFlow o desde cualquier integración que lea las órdenes de Aqua: la orden no distingue quién la llena, solo exige el token correcto y el precio.

### 4.4 Apostador: saldo insuficiente

1. Una orden tiene tope 1.000 pero la wallet solo tiene 300 sDAI (porque se llenó otra).
2. El panel la muestra como `activa`, con disponible real 300.
3. Una compra toma de esa orden como mucho lo que cubren los 300. Si hace falta más, **se salta esa orden** y sigue con la siguiente; una orden sin fondos nunca tumba la compra entera. El apostador no pierde nada.

### 4.5 Apostador: cancelar

1. En su panel, elige una orden y la cancela. Es una transacción `dock` en Aqua.
2. No mueve sDAI. La orden pasa a `cancelada` y deja de poder llenarse en ese mismo bloque.

### 4.6 Vencimiento

1. Llega el `vencimiento` de la orden, o el mercado se resuelve antes.
2. Nadie hace nada: la orden rechaza cualquier llenado a partir de ahí. En el panel pasa a `vencida`.
3. El apostador puede cerrarla (`dock`) para limpiar su panel; no es obligatorio.

### 4.7 Cobrar

1. Reality.eth resuelve la pregunta y Seer reporta el resultado.
2. El apostador ve en "Posiciones" qué tokens ganaron.
3. Canjea: una transacción `redeemPositions` en Seer, que le entrega sDAI por sus tokens ganadores. Si el mercado se resolvió como inválido, sus tokens inválidos le devuelven lo que aportó.

---

## 5. Pantallas

| Pantalla | Qué muestra | Acción principal |
| --- | --- | --- |
| **Mercados** | Mercados binarios abiertos de Seer en Gnosis, con el mejor precio de SÍ y de NO que ofrecen las órdenes de OddsFlow, como probabilidad (0.20 = 20 %) | Abrir un mercado |
| **Mercado** | Pregunta, fecha de apertura de respuestas, órdenes por lado con su precio y cuánto pueden cubrir hoy | Comprar un lado (flujo 4.2) o vender tokens que ya tiene (4.3) |
| **Nuevas órdenes** | Lista editable de mercado · lado · precio · tope, y el saldo real de sDAI debajo | Publicar las órdenes (flujo 4.1) |
| **Mis órdenes** | Cada orden con estado, llenado / tope, vencimiento y cuánto podría cubrir hoy con el saldo real | Cancelar una orden |
| **Posiciones** | Tokens SÍ / NO / inválido por mercado, y cuáles ya se pueden canjear | Cobrar |

La aprobación de sDAI a Aqua no es una pantalla: aparece como primer paso dentro de "Nuevas órdenes" solo si falta.

**Unidades en todas las pantallas:** los precios se muestran como probabilidad, porque un token ganador vale exactamente 1 sDAI. Los montos van en sDAI, con su equivalente aproximado en dólares al lado: sDAI vale algo más de 1 USD y sube con el tiempo, así que el dólar es una ayuda, nunca la cifra que se firma.

---

## 6. Reglas de negocio

**Estados de una orden:**

| Estado | Cuándo |
| --- | --- |
| `activa` | Publicada, antes del vencimiento, `llenado < tope` |
| `llenada` | `llenado = tope` |
| `vencida` | Pasó el `vencimiento`, o el mercado se resolvió, sin llegar al tope |
| `cancelada` | El apostador hizo `dock` |

"Sin fondos" **no es un estado**: es una lectura del saldo real que el panel muestra al lado de una orden `activa`. La orden sigue viva y se vuelve llenable en cuanto vuelve a haber saldo.

**Reglas que el sistema hace cumplir** (no la interfaz: la cadena):

1. **Nunca peor que el precio firmado.** Por cada token de resultado que recibe, el apostador paga como máximo `precioMax` sDAI.
2. **Una sola dirección.** La orden entrega sDAI a cambio de tokens de resultado, nunca al revés. Si no, cualquiera podría comprarle al apostador los tokens SÍ que ya recibió.
3. **Tope acumulado.** La suma de todos los llenados de una orden nunca supera su `tope`.
4. **Nada después del vencimiento ni con el mercado resuelto**, y el vencimiento nunca es posterior a la apertura de respuestas del mercado.
5. **Todo o nada.** El sDAI del apostador sale y sus tokens llegan en la misma transacción. En la creación, además, el aporte de la contraparte, el split y la entrega a cada uno. Si falta cualquiera, no pasa ninguno.
6. **Token exacto.** La orden solo acepta el token de su mercado y su lado. No importa de dónde venga: todo token de resultado de Seer está respaldado 1:1 por colateral desde que existe.
7. **Inválido en proporción al aporte, cuando hay creación.** Si los tokens se crean en el llenado, los inválidos se reparten según lo que puso cada uno, y si el mercado se anula cada uno recupera exactamente lo suyo. En una venta, el apostador recibe solo su lado, igual que si comprara en cualquier otro lugar.
8. **Solo mercados binarios de Seer en Gnosis, con colateral sDAI.** Cualquier otro mercado se rechaza al publicar.

**La regla que no puede fallar** (va con nombre propio al §5 del [05](./05_stack-y-arquitectura.md)): **el sDAI del apostador nunca sale de su wallet sin que, en la misma transacción, reciba sus tokens de resultado al precio que firmó.** Las reglas 1, 2, 5 y 6 son las cuatro caras de esa misma promesa. Dónde vive cada una: 1 y 2 en el opcode `FixedPriceSwap`; 3 en el saldo virtual de Aqua; 4 en `Deadline` y `OnlyUnresolvedCondition`; 5 en que todo ocurre en una sola transacción; 6 en los tokens con que se publica la estrategia (ver [03](./03_bounties.md#1-1inch--build-an-aqua-app)).

**Riesgo que el sistema no cubre:** una orden es un precio fijo que no se entera de las noticias. Si el resultado se vuelve evidente antes de que el mercado abra a respuestas, alguien puede llenar una orden con precio viejo. La defensa es del apostador: cancelar o poner un vencimiento más corto. La interfaz lo dice al publicar.

---

## 7. Qué queda fuera de esta versión

- **Operar en USDC.** Seer en Gnosis solo acepta sDAI y su Router no convierte. Convertir dentro del llenado metería un DEX y slippage dentro del precio de la orden, rompiendo el principio 2. → [08](./08_roadmap.md).
- **Vender una posición antes de la resolución.** Solo hay órdenes de compra. Salir antes exige el camino inverso (merge) y un segundo tipo de orden.
- **Mercados categóricos, escalares y multi-resultado.** El reparto de colateral entre más de dos lados cambia el modelo del llenado.
- **Cruzar dos órdenes de OddsFlow entre sí** (un apostador de SÍ contra uno de NO sin contraparte que firme). Necesita alguien que ejecute y pague gas, y eso es un operador.
- **Otras redes** (Gnosis tiene 10 veces más mercados de Seer). Mismo diseño, otro colateral (sDAI).
- **Un presupuesto global menor que el saldo de la wallet** ("de mis 5.000, apuesta como mucho 1.000"). Exige un contrato que lleve la cuenta entre órdenes, y el mismo efecto se logra usando una wallet solo para apostar.
- **Notificaciones** de llenado o vencimiento.

---

## 8. Decisiones tomadas y pendientes

**Tomadas:**

- Gnosis Chain, colateral sDAI ([03](./03_bounties.md)).
- Una orden = una estrategia de Aqua, con el saldo compartido entre todas.
- Precio fijo con un opcode propio, `FixedPriceSwap`, en un router de SwapVM redesplegado sobre el Aqua oficial: el router oficial no tiene precio fijo y `LimitSwap` no sirve sobre saldos de Aqua ([03](./03_bounties.md#1-1inch--build-an-aqua-app)).
- Publicar es una transacción `ship` por orden, agrupadas en una sola confirmación cuando la wallet lo admite.
- Vencimiento por `Deadline`, por defecto en la apertura de respuestas del mercado, más el opcode `OnlyUnresolvedCondition`, que rechaza si el mercado ya está resuelto.
- Una orden se puede llenar de dos formas: creación de tokens (contraparte con sDAI) o venta (quien ya tiene tokens).
- Una compra recorre varias órdenes, de la más barata a la más cara, con un mínimo que fija la contraparte.
- Los tokens inválidos se reparten en proporción al aporte cuando hay creación.
- Precios como probabilidad; montos en sDAI con el dólar como referencia.
- La demo usa un mercado binario creado por nosotros en Seer, para controlar la pregunta, la apertura a respuestas y la resolución ([05](./05_stack-y-arquitectura.md#1-decisiones)).
- El libro de órdenes se arma con los eventos `Shipped` de Aqua, que incluyen el programa completo de cada orden: cualquiera puede reconstruirlo desde la cadena.

**Pendientes:**

- ~~**Cuántas órdenes puede recorrer una compra.**~~ Hasta 10, medido ([05 §6](./05_stack-y-arquitectura.md#6-el-cálculo-central-el-precio-fijo-y-el-reparto-en-una-compra)).
- **Compuerta del día 1** del [03](./03_bounties.md#pendientes): si el router redesplegado no se comporta como se espera, el precio fijo pasa a la misma lógica vía `Extruction` en el router oficial. El diseño de producto no cambia; cambia a qué router apunta la orden.
