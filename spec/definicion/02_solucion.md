# 02 — Solución

> **Alcance de este documento:** qué es OddsFlow y qué obtiene cada actor. **No define pantallas ni stack.**
> **Depende de:** [01 — Contexto y Problema](./01_contexto-y-problema.md)

---

## Qué es

**OddsFlow permite apostar en muchos mercados de predicción con el mismo dinero, comprometiéndolo solo cuando aparece la contraparte.**

Elimina el trade-off del [01](./01_contexto-y-problema.md) convirtiendo cada apuesta en una **orden a precio fijo que no bloquea capital**. El usuario define en qué mercados quiere entrar y a qué precio, y publica sus órdenes. **Su dinero no sale de su wallet.** A través de **1inch Aqua**, todas sus órdenes se respaldan con el mismo saldo.

Cuando alguien quiere el lado contrario a ese precio, **la orden se ejecuta sola**: el dinero sale en ese momento, solo en ese mercado y solo por lo necesario. Las demás órdenes siguen activas con lo que queda.

El ciclo del apostador deja de exigir repartir el capital a ciegas:

**Elegir mercados y precios → publicar las órdenes → el dinero espera en la wallet → se compromete solo donde aparece contraparte → cobrar.**

Compite contra la forma actual de apostar a un precio: depositar o reservar capital por separado en cada mercado.

---

## Cómo funciona

### Para quien apuesta

**1. Elegir.** Escoge los mercados y, en cada uno, el lado y el precio máximo. Por ejemplo, con 1.000 sDAI en la wallet: SÍ a 0.20 o menos en el mercado A y SÍ a 0.25 o menos en el B, y cada orden puede usar los 1.000.

**2. Publicar.** Aprueba el uso de su sDAI una sola vez y publica una orden por mercado, todas en una sola confirmación si su wallet lo permite. Publicar cuesta gas, pero **no se mueve dinero**.

**3. Esperar.** El sDAI sigue en su wallet. El mismo saldo respalda todas sus órdenes a la vez.

**4. Ejecutarse.** Cuando aparece alguien dispuesto a darle su lado a ese precio, en una sola transacción el apostador paga y recibe sus tokens. Los tokens llegan de una de dos formas: se crean en ese momento, juntando su dinero con el de quien quiere el lado contrario, o se los vende alguien que ya los tenía. En las dos paga como máximo su precio. Lo que se usó sale de su wallet, así que sus otras órdenes cuentan con ese saldo menos.

**5. Cerrar.** Cada orden vence, como tarde, cuando el mercado empieza a aceptar respuestas, y se niega a ejecutarse si el mercado ya está resuelto. Nadie puede venderle tokens de un resultado ya reportado.

**6. Cobrar.** Si acertó, canjea sus tokens ganadores por el colateral. Si el mercado se anula, recupera lo que corresponda por sus tokens de resultado inválido.

### Para la contraparte

Entra a un mercado, elige lado y cantidad, y ve el precio. **Firma una sola transacción.** No necesita saber que existe una orden de otra persona: el sistema toma las mejores ofertas disponibles, de la más barata a la más cara, y las ejecuta dentro de su compra. Paga el gas de esa transacción.

Quien ya tiene tokens de resultado de un mercado también puede vendérselos directamente a una orden, sin pasar por la creación de tokens.

---

## Qué resuelve

- **Dinero que no queda atrapado:** el capital solo se compromete cuando una orden se llena. Mientras tanto sigue en la wallet.
- **Apuestas que no se pierden por falta de fondos:** cada orden puede usar todo el saldo disponible, no una porción fija asignada de antemano.
- **Sin repartir a ciegas:** el usuario no tiene que adivinar dónde aparecerá la contraparte. El dinero va solo a donde se ejecuta una orden.
- **Ejecución sin estar presente:** las órdenes ya están firmadas. No depende de que el usuario esté mirando el precio.
- **Pago garantizado a los ganadores:** cada token existe solo si su colateral ya está depositado.

**El mismo dinero está disponible en todos los mercados, pero solo se usa donde hay contraparte.**

Límites a tener en cuenta:

- Si se llenan varias órdenes a la vez y superan el saldo real, las siguientes fallan sin ejecutarse. El usuario no pierde dinero, pero tampoco entra en esos mercados.
- Una orden es un precio fijo que no se entera de las noticias. Si el resultado se vuelve evidente antes de que el mercado abra a respuestas, alguien puede llenar una orden con precio viejo. Es el riesgo de cualquier orden límite: el apostador lo controla cancelando o poniendo un vencimiento más corto.

---

## Alcance inicial

- **Mercados:** binarios (SÍ/NO) de **Seer**, cuyos tokens de resultado ya son ERC20.
- **Red:** **Gnosis Chain**, donde coinciden Aqua y los mercados activos de Seer ([03](./03_bounties.md#marco)).
- **Colateral:** **sDAI**, el que usan los mercados de Seer en Gnosis (verificado onchain, ver [03](./03_bounties.md)). El apostador y la contraparte operan en sDAI; convertir desde USDC queda fuera de este alcance.
- **Órdenes:** compra de SÍ o NO a precio máximo, con tope de monto y vencimiento, como tarde, al abrir el mercado a respuestas.
