# Battle Tower V2 — capturas reales del juego

Capturadas desde Chromium sobre el servidor Vite local. Las partidas de prueba viven en contextos aislados de navegador; no se usó el perfil personal ni se alteraron sus guardados.

- `art/`: título, tres ranuras, protagonistas, plaza, instructores, combate y guía a 1920×1080, 1366×768, 1280×720, 915×412 y 800×360; golpe aceptado, transformación, victoria y recompensa del jefe.
- `ui/`: seis árboles, tabla de tipos, biblioteca de 90 ejercicios, cuatro ataques iniciales, entrenamiento de habilidad bloqueada, campamento, Flash y recompensas.
- `support/`: diario conservado, sus cinco capítulos, tema oscuro, modal de comida y pantalla de vinculación del teléfono.
- `mobile/`: revisión posterior del combate horizontal. Escenario de 164px de alto a 800×360 y 216px a 915×412, seis controles de batalla de al menos 44px. Cámara y guías mantienen su distribución. Las dos imágenes `art/boss-battle` móviles se han actualizado con estas capturas.

Las cuatro suites terminaron sin errores de consola. Se comprobó carga de recursos, ausencia de referencias activas al arte anterior durante el juego, alineación de pies, daño por unidad manual, cambio de fase, victoria, desbloqueo Flash manual, sustitución de cuatro slots, persistencia y reanudación de entrenamiento.

Las pruebas no afirman precisión del reconocimiento físico, vinculación real de dos dispositivos ni validación de sensores Android. Los ejercicios experimentales y manuales mantienen sus etiquetas. Las instrucciones de movimientos son texto específico: no se presentan como demostraciones gráficas revisadas.

Pruebas reproducibles desde la raíz del proyecto (servidor ya iniciado):

```sh
GAME_URL=http://127.0.0.1:5174 node tests/tower-v2-art-browser.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-v2-ui-browser.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-v2-support-browser.mjs
GAME_URL=http://127.0.0.1:5174 node tests/tower-v2-mobile-battle-browser.mjs
```

Conteo de PNG por carpeta: {"mobile": 5, "ui": 25, "support": 8, "art": 44}.
