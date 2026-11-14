# Entrega local de Real-Life Battle Tower

La aplicación existente se ha convertido en un juego de torres físicas. No es un proyecto paralelo: reutiliza cámara, MediaPipe, coach, transporte del teléfono, almacenamiento, diario y plataforma Android. La exploración, mapas, edificios, narrativa de medallas, XP y niveles se han retirado del flujo activo.

## Resultado jugable

- Torre procedural reproducible por semilla/piso hasta 1.000.000.000, sin generar ni almacenar todos los pisos. Vida enemiga acotada, guardianes y jefes por fases, tres tipos y STAB. Recuperación entre encuentros; descansos libres y salida conservando logros.
-30 habilidades con dependencias, cuatro candidatas iniciales, pruebas repetibles, desbloqueo permanente y cuatro espacios. Los tres árboles muestran conexiones y requisitos. Equipamiento y especialización se cambian entre encuentros de la torre infinita; los desafíos mantienen su conjunto fijo.
-7 desafíos con requisitos visibles y especializaciones obtenidas mediante sus correspondientes logros.
- Rutinas guardables y editables, orden de ejercicios, objetivos exactos, descansos y división en series acotadas.30 escenarios distintos reaccionan a unidades aceptadas. El entrenamiento independiente conserva procedencia manual/cámara y no inventa puntuaciones técnicas.
- Tres partidas independientes, registros, ajustes, modo sin conexión y vista previa local separada. La vista previa permite probar habilidades y pisos sin modificar una partida real ni sincronizarse.

## Identidad gráfica

69 PNG originales producidos en su resolución nativa mediante geometría de píxeles: dos protagonistas, ocho identidades enemigas, atlas animados, seis arenas, torre monumental,16 iconos y 11 ilustraciones de ejercicios. Otros 30 escenarios se dibujan con operaciones enteras sobre canvas. Ningún gráfico activo usa la antigua biblioteca. ASSET_GUIDE.md documenta paleta, tamaños, anclajes, recursos, autoría y sustitución.

Pantallas renovadas: logo/título, tres partidas, protagonista, menú de torre, árboles e inspección de habilidades, pruebas, preparación, combate y fases, descansos/resultados, desafíos, rutinas/minijuegos, récords, ajustes, dispositivos, cámara y diario. La cámara opcional del teléfono se muestra en el panel de ejercicio únicamente tras activarla en el móvil.

## Entrega y evidencia

- Juego de desarrollo: `http://localhost:5174` mientras Vite siga abierto. Para reiniciarlo: `npm run dev -- --port 5174`.
- APK debug instalable: `releases/battle-tower-debug.apk`.
- Galería: [capturas reales](verification/battle-tower/index.html).
- [Pruebas y límites](../QA.md), [evidencia de compilación y hash](verification/battle-tower/build-evidence.json), [lista completa de archivos cambiados](verification/battle-tower/CHANGED_FILES.txt).

Comprobaciones:287 tests,240 combates estratégicos simulados, cinco resoluciones, los 30 minijuegos, SQL de seguridad/idempotencia, inferencia MediaPipe sin cuerpo, transporte WebRTC sintético, diario y arranque offline. El APK está firmado, instalado y abierto en un emulador Android; sus 81 archivos web coinciden con producción.

## Pendiente de validación externa

La precisión con personas reales, conexión con teléfono físico, permisos/sensores Android y rendimiento prolongado requieren dispositivos físicos. Las variantes experimentales y manuales están identificadas; no se presentan como 30 detectores físicamente validados.

Supabase tiene migración, endpoint canónico y pruebas locales preparados, pero no se ha desplegado: falta una sesión CLI autenticada. La verificación real entre dispositivos debe hacerse tras ese despliegue. No se ha publicado una web ni se han solicitado o expuesto credenciales.

Se usaron worktrees separados para núcleo, UI/QA y arte; el integrador coordinó los contratos y cambios compartidos. El historial conserva los sistemas retirados y las partidas antiguas no se traducen a progreso de torre.
