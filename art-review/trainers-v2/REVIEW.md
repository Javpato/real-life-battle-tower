# Battle Tower — tres propuestas de entrenador

Estado: **prueba artística estática pendiente de aprobación**, no un reemplazo completo del juego. Los PNG de `final/` son las exportaciones de esta prueba; el nombre de la carpeta no significa que se hayan aprobado para producción.

Abrir `index.html` para comparar a tamaño real, ampliar exactamente 4× y alternar fondos. `comparison.png` reúne los tres diseños y ejemplos de la referencia. En pantallas pequeñas la lámina completa puede reducirse para encajar: la galería mantiene los sprites a 96 y 384 píxeles CSS, con desplazamiento interno cuando hace falta.

## Dirección extraída de la referencia

La hoja proporcionada usa celdas de aproximadamente 65×65, figuras humanas de altura variable y poses muy distintas. Importan las siluetas y la anatomía legible, no solo la resolución: extremidades con volumen, solapamientos claros, ropa en grupos de color, cabello reconocible y contornos selectivos oscuros. La luz superior separa piel, prendas y accesorios mediante pocos tonos. Los píxeles de ojos y manos tienen una función concreta.

Los diseños nuevos conservan esos principios sin reproducir personajes de la hoja. Paleta común: sombras azul/ciruela, luces cálidas, coral y marfil como acentos; jade para A, ciruela para B, azul para C. No se emplearon sprites de StudyVillage ni geometría del personaje anterior.

Se probó 64×64 y se descartó esa extracción por perder la lectura de cara y manos. Estas propuestas usan 96×96 RGBA, 27/30/29 colores opacos, alfa binario, línea de pies y=92 y pivote [48,92]. Los cuerpos ocupan aproximadamente 87–88 píxeles de alto. Esto los hace mayores que muchos entrenadores de la referencia: no se afirma una equivalencia de densidad exacta.

## Evaluación visual

| Criterio | A · Atleta de aventura | B · Especialista de fuerza | C · Entrenador veterano |
|---|---|---|---|
| Anatomía | Peso desplazado, brazos diferenciados, piernas con pliegues. La mano abierta sigue siendo pequeña. | Guardia asimétrica y apoyo ancho reconocibles. La mano baja necesita mantenerse clara en animación. | Postura estable y palma adelantada. Los dedos de la palma están simplificados. |
| Detalle | Pañuelo, chaleco, cinturón, toalla y calzado separables. | Trenza, chaqueta corta, guantes y mallas dan identidad propia. | Chaqueta, barba, pañuelo y pelo plateado expresan una identidad adulta. |
| Silueta | Gesto abierto claro; toalla y hombro podrían confundirse en una pose distinta. | La más distintiva por trenza y guardia. | Cabeza y palma muy legibles; cuerpo más convencional. |
| Sombreado | Jade y coral con volumen, sombras de pantalón agrupadas. | Piel marrón corregida sin recolorear chaqueta/cabello; pantalón oscuro menos visible sobre azul. | Buen contraste marfil/azul; barba fría separada de la piel cálida. |
| Píxeles | Ojos/cejas/boca retocados; algunos escalones del pantalón son irregulares. | Cara y piel retocadas; los rizos todavía concentran bastante detalle. | Ojos y barba retocados; vigilar contorno de palma y cabello. |
| Coherencia | Comparte iluminación, contorno y acentos con B/C. | Mejor candidata para fijar la personalidad del conjunto. | Buena segunda referencia para contraste y personajes de más edad. |

Recomendación: **B como punto de partida**, usando la separación de luces de C como referencia interna. No se acepta una propuesta únicamente por pasar validaciones técnicas. Las tres mejoran el volumen y la expresividad del personaje anterior, pero siguen siendo pruebas generadas y retocadas; no se certifica todavía calidad comercial, animación consistente o fidelidad exacta a los sprites GBA.

## Proceso realizado

1. Instalación de Pixel Art Studio desde su repositorio oficial. Ruta local: `/home/javpato/.codex/skills/pixel-art-studio`. Render de su ejemplo de prueba correcto. La skill es un flujo de trabajo y herramientas, no un modelo artístico independiente.
2. Generación artística integrada `image_gen`: tres conceptos originales transparentes. Prompts completos en `prompts.json`. No se utilizó la alternativa CLI.
3. Segunda generación de cada concepto usando la hoja del usuario como referencia de construcción de píxeles. Prompt en `redraw-prompt.txt`. Se conservaron las seis imágenes de origen en `sources/`.
4. Preparación a 96×96 y paleta acotada con `prepare-native.py`. La generación devuelve imágenes grandes; **no devuelve directamente estos PNG nativos**. El simple resultado de reducirlas no se declaró terminado.
5. Inspección a 1×/4× y retoques locales en `retouch.py`: A 16 píxeles, B 198, C 35. No se dibujaron cuerpos, poses ni ropa mediante geometría programática. Registro exacto de coordenadas y colores en `final/retouch-report.json`.
6. Exportación de PNG transparentes y cuadrículas JSON editables mediante Pixel Art Studio. Comprobación exacta de reconstrucción y ampliación nearest-neighbor en `package-proof.py`; resultados en `validation.json`.
7. Galería inspeccionada en Chrome en seis tamaños, incluidos los cinco solicitados para el juego y 390×844. Evidencia en `qa/`; esto verifica la galería, **no constituye una nueva prueba del juego, de MediaPipe ni de Android**.

Los scripts de Pillow hacen preparación, retoque limitado y montaje de la comparación. El ilustrador primario fue el modelo de imágenes. No se utilizó el generador de personajes 16×16 de la skill ni `scripts/build-tower-art.py`.

## Herramientas y PixelLab

Se consultaron las instrucciones oficiales de [Pixel Art Studio](https://github.com/MingfengHong/pixel-art-studio/blob/main/skills/pixel-art-studio/SKILL.md), su [instalación](https://github.com/MingfengHong/pixel-art-studio/blob/main/INSTALL.md) y [PixelLab MCP](https://www.pixellab.ai/mcp).

PixelLab **no está conectado** en esta sesión. No se hicieron llamadas de generación ni se consumieron créditos de PixelLab. Para usarlo posteriormente hace falta obtener un token en la cuenta de PixelLab y configurar un servidor MCP HTTP con URL `https://api.pixellab.ai/mcp` y autenticación `Authorization: Bearer <token>`, mediante un campo seguro o variable de entorno. El saldo o plan necesario depende de las herramientas elegidas y se debe comprobar en la cuenta. No guardar tokens en el proyecto ni pegarlos en el chat. La vía integrada elegida para esta prueba ya funciona sin esa conexión.

## Archivos y reproducción

- `final/*.png`: tres candidatos y sus ampliaciones 4×.
- `final/*.json`: fuentes editables; `retouch-report.json` documenta los cambios.
- `sources/`: conceptos y redibujos generados originales.
- `drafts/`: extracciones de 64×64 rechazadas; **no utilizar como assets finales**.
- `working/`: preparación intermedia de 96×96 antes del retoque.
- `comparison.png`, `index.html`, `qa/`: comparación y evidencia de navegador.
- `NEXT_PHASE.md`: decisiones jugables conservadas para el siguiente bloque.

Desde la raíz del proyecto:

```sh
python3 art-review/trainers-v2/prepare-native.py
python3 art-review/trainers-v2/retouch.py
python3 art-review/trainers-v2/package-proof.py
node art-review/trainers-v2/verify-gallery.mjs
```

Requiere Python/Pillow, Pixel Art Studio instalado, fuentes DejaVu, las dependencias Node del proyecto y Chrome. La generación original no es determinista; los pasos locales sí reproducen la exportación a partir de `sources/`.

## Alcance y siguiente paso

Se conserva el juego actual sin sustituir assets activos. No se modificaron combate, cámara, guardado, sincronización, progresión ni Training Grounds en esta entrega. Los cambios jugables del plan —cuatro ataques iniciales, oportunidades cada tres pisos, jefes cada cinco, mejoras/Flash y catálogo completo para entrenar— están pendientes, documentados en `NEXT_PHASE.md`.

Primero hace falta la elección o corrección artística del usuario, como pidió explícitamente. Después se podrá extender la dirección elegida y verificar poses/animaciones dentro del juego. No se han producido aún esos spritesheets ni se ha simulado una animación moviendo únicamente esta imagen estática.

## Referencias y autoría

`reference-user-provided.png` y sus recortes son la hoja de Pokémon Ruby/Sapphire/Emerald aportada por el usuario, atribuida a Nintendo/Game Freak en la propia imagen. Se conservan solo para comparación artística, fuera del paquete de assets del juego. `previous-character.png` es el personaje anterior del proyecto, también solo para comparación. Ninguno de sus píxeles se copió a los candidatos.
