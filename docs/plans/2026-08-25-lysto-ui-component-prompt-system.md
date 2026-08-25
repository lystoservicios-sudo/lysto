# Lysto UI Component Prompt System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Crear un prompt maestro exhaustivo que genere componentes reales y composiciones responsive para todos los patrones presentes en las 19 referencias visuales de Lysto.

**Architecture:** Un único documento versionado contendrá el contrato maestro, un registro de componentes base y funcionales, prompts ejecutables por componente, una matriz de cobertura y 19 prompts de composición. Los prompts de composición reutilizarán el registro y no podrán crear navegación ni duplicar componentes existentes.

**Tech Stack:** Markdown, React 19, Next.js 15 App Router, TypeScript, Tailwind CSS, Lucide React, Vitest y Testing Library.

---

### Task 1: Crear el contrato maestro y el registro de cobertura

**Files:**
- Create: `prompts/03-ui-component-generator.md`
- Reference: `docs/plans/2026-08-25-lysto-ui-component-prompt-system-design.md`
- Reference: `components/ui/*.tsx`
- Reference: `components/pro/ui/*.tsx`

**Step 1: Verificar que el entregable todavía no existe**

Run:

```powershell
Test-Path prompts/03-ui-component-generator.md
```

Expected: `False`.

**Step 2: Crear el encabezado del documento**

Incluir:

- modo de uso;
- contexto Lysto;
- intención visual;
- stack obligatorio;
- reglas de accesibilidad y responsive;
- formato de entrega del agente;
- prohibición de crear o modificar navegación;
- protocolo para inspeccionar componentes existentes antes de crear archivos.

**Step 3: Crear el registro de componentes**

Agregar una tabla con nombre, capa, propósito, variantes, referencia visual y componentes existentes relacionados. Debe contener al menos 55 entradas únicas.

**Step 4: Crear la matriz de cobertura**

Agregar 19 filas, una por referencia. Cada fila debe enumerar secciones y componentes del registro.

**Step 5: Verificar conteos iniciales**

Run:

```powershell
$content = Get-Content -Raw prompts/03-ui-component-generator.md
([regex]::Matches($content, '^\| REF-[0-9]{2} ', 'Multiline')).Count
([regex]::Matches($content, '^\| CMP-[0-9]{3} ', 'Multiline')).Count
```

Expected: `19` referencias y al menos `55` componentes.

### Task 2: Escribir los prompts ejecutables de componentes

**Files:**
- Modify: `prompts/03-ui-component-generator.md`

**Step 1: Agregar la plantilla común**

Definir variables para `[COMPONENTE]`, `[RUTA_DESTINO]`, `[DATOS_DEL_DOMINIO]`, `[VARIANTES]` y `[ACCIONES]`. Indicar que cada subprompt se ejecuta después del prompt maestro.

**Step 2: Agregar prompts de primitives**

Cubrir como mínimo:

- estados, confianza, iconos y avatares;
- métricas y dinero;
- progreso, tabs y filtros;
- imágenes y galería;
- acciones y estados de datos.

**Step 3: Agregar prompts de componentes funcionales**

Cubrir:

- encabezados, banners, recursos y beneficios;
- agenda;
- solicitudes, trabajos, diagnóstico y aprobación;
- dashboard y crecimiento profesional;
- equipos, mantenimiento, pagos, garantías y calidad;
- wizard, multimedia, presupuesto, matching y confirmación.

Cada prompt debe especificar objetivo, API esperada, variantes, responsive, accesibilidad, estados y pruebas.

**Step 4: Verificar que todos los componentes del registro tengan prompt**

Run:

```powershell
$content = Get-Content -Raw prompts/03-ui-component-generator.md
$registered = [regex]::Matches($content, '^\| (CMP-[0-9]{3}) ', 'Multiline') | ForEach-Object { $_.Groups[1].Value }
$prompted = [regex]::Matches($content, '^### Prompt (CMP-[0-9]{3})', 'Multiline') | ForEach-Object { $_.Groups[1].Value }
Compare-Object $registered $prompted
```

Expected: sin diferencias.

### Task 3: Escribir las 19 composiciones de pantalla

**Files:**
- Modify: `prompts/03-ui-component-generator.md`

**Step 1: Agregar contrato de composición**

Exigir que el agente:

- use solamente componentes del registro;
- no replique la barra superior o lateral de las capturas;
- implemente layout mobile-first y reorganización desktop;
- conecte datos mediante props o funciones de servidor existentes;
- no introduzca mocks productivos;
- incluya loading, vacío, error y permisos cuando correspondan.

**Step 2: Agregar un prompt por referencia**

Crear encabezados exactos `### Composición REF-01` hasta `### Composición REF-19`.

**Step 3: Incluir checklist visual por composición**

Cada prompt debe enumerar:

- jerarquía de secciones;
- componentes usados;
- comportamiento mobile y desktop;
- acciones principales y secundarias;
- estados semánticos;
- elementos excluidos.

**Step 4: Verificar las 19 composiciones**

Run:

```powershell
$content = Get-Content -Raw prompts/03-ui-component-generator.md
([regex]::Matches($content, '^### Composición REF-[0-9]{2}', 'Multiline')).Count
```

Expected: `19`.

### Task 4: Validar integridad y entregar

**Files:**
- Modify: `prompts/03-ui-component-generator.md`

**Step 1: Comprobar exclusión de navegación**

Run:

```powershell
rg -n "no (crear|modificar|generar).*(navegación|sidebar|barra superior)|ignorar.*navegación" prompts/03-ui-component-generator.md
```

Expected: reglas explícitas en el contrato maestro y las composiciones.

**Step 2: Comprobar stack y calidad**

Run:

```powershell
rg -n "React|Next.js|TypeScript|Tailwind|Lucide|Vitest|Testing Library|ARIA|focus-visible|loading|empty|error" prompts/03-ui-component-generator.md
```

Expected: todos los requisitos presentes.

**Step 3: Revisar cobertura manualmente**

Comparar las 19 filas de la matriz con las 19 imágenes y confirmar que cada bloque de contenido visible tenga un componente o composición asignada.

**Step 4: Revisar cambios**

Run:

```powershell
git diff --check
git diff -- prompts/03-ui-component-generator.md
```

Expected: sin errores de whitespace y únicamente el entregable esperado.

**Step 5: Commit**

```powershell
git add prompts/03-ui-component-generator.md docs/plans/2026-08-25-lysto-ui-component-prompt-system.md
git commit -m "docs: add exhaustive ui component prompts"
```

