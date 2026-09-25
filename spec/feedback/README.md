# Feedback a los sponsors — índice

Bitácora viva de lo que cada sponsor documenta o promete frente a lo que
encontramos al construir OddsFlow. No es una opinión al final del hackathon:
cada entrada se escribe **el mismo día** que se descubre algo, con la evidencia
a la mano — un archivo:línea, un mensaje de error exacto, un comando, una
captura.

No es una queja unilateral: cada archivo abre con lo que funcionó bien.

| Sponsor | Archivo | Para qué además sirve |
| ------- | ------- | --------------------- |
| 1inch | [01_1inch.md](./01_1inch.md) | Aqua y SwapVM son el núcleo del producto: cualquier diferencia entre sus docs y sus contratos desplegados cambia el diseño de la orden |

Seer no es sponsor, así que lo que se encuentre de Seer (por ejemplo, que su
colateral en Base es sUSDS y la documentación no lo dice) va al
[03](../definicion/03_bounties.md), no aquí.

## Cómo se usa cada archivo

1. **Se escribe en el momento**, no de memoria al final.
2. **Formato de cada entrada:** qué se documentaba o se esperaba, qué se
   encontró en la práctica, la evidencia exacta, el impacto que tuvo, y si se
   reportó aguas arriba (issue, PR, formulario del sponsor).
3. **La severidad no se infla.** Una diferencia que no costó nada es una
   nota, no un hallazgo.
4. **Al cerrar cada fase del [07](../definicion/07_plan-de-trabajo.md)**, se
   revisa si algo de esa fase merece una entrada aquí.
5. **Antes de enviar el proyecto,** cada archivo cierra con qué se reportó
   aguas arriba y qué quedó solo documentado aquí.

## Qué entra y qué no

**Entra:** una discrepancia entre lo que la documentación dice y lo que el
código hace; un error opaco que costó tiempo entender; un límite no
documentado; algo que funcionó mejor de lo esperado.

**No entra:** un error propio (una llamada mal armada, algo desactualizado a
mano) — eso es un bug del proyecto, no feedback al sponsor.
