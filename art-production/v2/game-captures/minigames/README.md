# Catálogo completo de entrenamiento — prueba en navegador

`tests/tower-minigames.mjs` descubre los 90 IDs desde el selector real de ejercicios de una rutina. Usa una partida de demostración en un contexto Chromium aislado y completa nueve rutinas de diez ejercicios, con dos unidades manuales por ejercicio y descanso configurado a cero.

Comprueba para cada ejercicio:

- Escena con su ID y progreso visible de 0 a 1 y a 2 unidades; el último ejercicio de cada lote se comprueba en el resumen final.
- Canvas nativo 480×270, completamente pintado y con el nuevo arte cargado.
- Instrucciones específicas disponibles y reconocimiento manual identificado como no verificado cuando corresponde.
- Resultado exacto de 2/2, cero unidades de cámara y dos manuales; sin estrellas técnicas inventadas.
- Cada lote termina con diez series, cero omisiones y veinte unidades manuales.

Se conservan seis capturas, una por tipo. Las actividades comparten el sistema de avance, gemas y seis ambientes ilustrados; este informe no afirma que existan 90 mecánicas de minijuego diferentes. `minigames-report.json` contiene el resultado individual de los 90 ejercicios, recursos cargados y errores detectados.

No prueba precisión física de MediaPipe, sensores Android ni vinculación real entre dispositivos.

```sh
GAME_URL=http://127.0.0.1:5174 node tests/tower-minigames.mjs
```
