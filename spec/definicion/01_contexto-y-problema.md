# 01 — Contexto y Problema

> **Alcance de este documento:** qué está pasando y por qué duele. **No propone solución.**

---

## Contexto

Quien quiere dar liquidez o apostar en mercados de predicción onchain tiene que poner capital en cada mercado por separado. Ese capital queda bloqueado en el mercado hasta que se resuelve.

**Elegir mercado → depositar capital → esperar la resolución (semanas o meses) → retirar → repetir.**

Durante casi toda esa espera nadie opera contra ese capital: **está bloqueado, pero no se usa.**

## Problema

Como cada mercado exige su propio capital por adelantado, estar en 10 mercados cuesta 10 veces más que estar en uno. Además, hay que decidir cuánto poner en cada uno antes de saber dónde habrá demanda:

- Donde sobra, el capital queda quieto hasta la resolución.
- Donde falta, las operaciones no se ejecutan, aunque haya dinero ocioso en otro mercado.

El resultado: **la liquidez se concentra en los mercados grandes y los nuevos o de nicho se quedan sin contraparte.**

El usuario termina enfrentando un trade-off:

> **¿Cubrir pocos mercados con capital suficiente o muchos con capital insuficiente?**

Hoy hay que elegir. La pregunta que queda abierta es si tiene que ser así:

> **¿Y si el mismo capital pudiera respaldar muchos mercados a la vez y comprometerse solo cuando alguien opera?**
