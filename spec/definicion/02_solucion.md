# 02 — Solución

> **Alcance de este documento:** qué es [Nombre] y qué obtiene cada actor. **No define pantallas ni stack.**
> **Depende de:** [01 — Contexto y Problema](./01_contexto-y-problema.md)

---

## Qué es

**[Nombre] permite apostar en muchos mercados de predicción con el mismo dinero, comprometiéndolo solo cuando aparece la contraparte.**

Elimina el trade-off del [01](./01_contexto-y-problema.md) convirtiendo cada apuesta en una **orden a precio fijo que no bloquea capital**. El usuario define en qué mercados quiere entrar y a qué precio, y firma sus órdenes. **Su dinero no sale de su wallet.** A través de **1inch Aqua**, todas sus órdenes se respaldan con el mismo saldo.

Cuando alguien quiere el lado contrario a ese precio, **la orden se ejecuta sola**: el dinero sale en ese momento, solo en ese mercado y solo por lo necesario. Las demás órdenes siguen activas con lo que queda.

El ciclo del apostador deja de exigir repartir el capital a ciegas:

**Elegir mercados y precios → firmar las órdenes → el dinero espera en la wallet → se compromete solo donde aparece contraparte → cobrar.**

Compite contra la forma actual de apostar a un precio: depositar o reservar capital por separado en cada mercado.

---

## Cómo funciona

### Para quien apuesta

**1. Elegir.** Escoge los mercados y, en cada uno, el lado y el precio máximo. Por ejemplo: SÍ a 0.20 o menos en el mercado A y SÍ a 0.25 o menos en el B, hasta 1.000 sUSDS en total.

**2. Firmar.** Aprueba el uso de su sUSDS una sola vez y firma una orden por mercado. **No se mueve dinero.**

**3. Esperar.** El sUSDS sigue en su wallet. El mismo saldo respalda todas sus órdenes a la vez.

**4. Ejecutarse.** Cuando alguien compra el lado contrario a un precio que cumple la orden, en esa misma transacción se juntan el dinero de ambos, se crean los tokens SÍ y NO respaldados 1:1 por colateral, y el apostador recibe su posición. Sus otras órdenes ven su saldo disponible reducido en lo que se usó.

**5. Cerrar.** Las órdenes vencen antes de la resolución del mercado. Nadie puede venderle tokens de un resultado ya conocido.

**6. Cobrar.** Si acertó, canjea sus tokens ganadores por el colateral.

### Para la contraparte

Entra a un mercado, elige lado y cantidad, y ve el precio. **Firma una sola transacción.** No necesita saber que existe una orden de otra persona: el sistema elige la mejor oferta disponible y la ejecuta dentro de su compra. Paga el gas de esa transacción.

---

## Qué resuelve

- **Dinero que no queda atrapado:** el capital solo se compromete cuando una orden se llena. Mientras tanto sigue en la wallet.
- **Apuestas que no se pierden por falta de fondos:** cada orden puede usar todo el saldo disponible, no una porción fija asignada de antemano.
- **Sin repartir a ciegas:** el usuario no tiene que adivinar dónde aparecerá la contraparte. El dinero va solo a donde se ejecuta una orden.
- **Ejecución sin estar presente:** las órdenes ya están firmadas. No depende de que el usuario esté mirando el precio.
- **Pago garantizado a los ganadores:** cada token existe solo si su colateral ya está depositado.

**El mismo dinero está disponible en todos los mercados, pero solo se usa donde hay contraparte.**

Límite a tener en cuenta: si se llenan varias órdenes a la vez y superan el saldo real, las siguientes fallan sin ejecutarse. El usuario no pierde dinero, pero tampoco entra en esos mercados.

---

## Alcance inicial

- **Mercados:** binarios (SÍ/NO) de **Seer**, cuyos tokens de resultado ya son ERC20.
- **Red:** **Base**, donde coinciden Seer y Aqua.
- **Colateral:** **sUSDS**, el que usan los mercados de Seer en Base (verificado onchain, ver [03](./03_bounties.md)). El apostador y la contraparte operan en sUSDS; convertir desde USDC queda fuera de este alcance.
- **Órdenes:** compra de SÍ o NO a precio máximo, con tope de monto y vencimiento antes de la
