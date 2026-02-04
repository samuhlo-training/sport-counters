# ◼️ BRUTALIST COMMENTING POLICY

**STYLE:** RAW. INDUSTRIAL. MINIMAL.
**GOAL:** INSTANT RECOGNITION & HIGH CONTRAST.

You are not writing prose. You are engraving instructions in concrete.
Avoid pleasantries. Use telegraphic style. Maximize visual separation.


### 0. FILE MANIFEST (THE HEADER)
Every file MUST start with a "Dog Tag" block. Identify the entity, its type, and its purpose in one glance. Use █ to anchor the component name. Always inside the `<script setup lang="ts">` tag.

Format:

```typescript
/**
 * █ [TYPE] :: COMPONENT_NAME
 * =====================================================================
 * DESC:   Telegraphic description of the component's purpose.
 * STATUS: [STABLE / WIP / DEPRECATED]
 * =====================================================================
 */

```
Real World Example:

```typescript
<script setup lang="ts">
/**
 * █ [UI_ATOM] :: IMAGE_CLIP_BOX
 * =====================================================================
 * DESC:   Utility wrapper. Applies specific CSS clip-path shapes.
 * USAGE:  Wraps <img /> elements to force aspect-ratio and shape.
 * =====================================================================
 */
// ...
```

---

##  1. VISUAL HIERARCHY (THE BLOCK SYSTEM)

Do not use standard headers. Use **visual blocks** to separate major logic sections.
Use `===` for major sections and `---` for minor separators.

### COMPONENT SECTIONS (Screaming Arch)

```typescript
// =============================================================================
// █ CORE: STATE & LOGIC
// =============================================================================
const user = ref(null);

// =============================================================================
// █ INTERACTION: HANDLERS
// =============================================================================
function handleSubmit() { ... }
```

### ➤ INLINE EMPHASIS
Use UPPERCASE for the "Why". Use arrows `->` to denote flow or consequence.

```typescript
// PREVENT MEMORY LEAK -> Clean up listener on unmount
useEventListener(window, 'resize', onResize);

// FORCE RE-RENDER -> Key change triggers component destruction
key.value++;
```

##  2. TYPESCRIPT (NO FLUFF)
If strictly necessary to comment a function, use a Block Summary. Skip obvious `@param` unless the type is complex.

```typescript
/**
 * ◼️ CALCULATE TOTAL
 * ---------------------------------------------------------
 * Adds taxes + shipping. Throws if country not supported.
 * * [CRITICAL]: Do not modify tax rate here. Use global config.
 */
export const calculateTotal = (price: number, country: string) => { ... }
```

##  3. LEGACY / JSDOC (STRICT & RAW)
Context: `.js` or `.vue` (no-ts). Format JSDoc as a structured data table, not a sentence.

```javascript
/**
 * ◼️ FETCH USER DATA
 * ---------------------------------------
 * @param {string} id  -> UUID v4
 * @param {bool}   raw -> If true, returns unparsed JSON
 * @returns {Promise<Object>}
 */
async function getUser(id, raw) { ... }
```

##  4. MAGIC NUMBERS (THE DICTIONARY)
Do not explain magic numbers inline. Extract them to a CONSTANTS block. The variable name IS the documentation.

```typescript
// [ BAD ]
setTimeout(fn, 500); // Wait for transition

// [ BRUTALIST APPROVED ]
const TRANSITION_DURATION_MS = 500;
setTimeout(fn, TRANSITION_DURATION_MS);
```

##  5. TAGGING SYSTEM (STATUS ALERTS)
Use square brackets `[]` and uppercase for status flags.

- `// [TODO]:` Missing functionality.
- `// [FIX]:` Known bug to be repaired.
- `// [HACK]:` Ugly solution required by external constraints.
- `// [NOTE]:` Critical context.
- `// [DEPRECATED]:` Do not use. Will be removed.

Example:

```typescript
// [HACK]: API returns string, forcing cast to number
const price = Number(data.price); 

// [TODO]: REFACTOR -> Move this logic to a composable
```

##  6. TEMPLATE COMMENTS (.vue)
Keep it sparse. Use HTML comments for structure. Avoid clutter.

```html
<!-- ======================================================================= -->
<!-- █ SECTION: NAVIGATION -->
<!-- ======================================================================= -->
<nav>
  <!-- --------------------------------------------------------------------- -->
  <!-- █ AUTH CONTROLS -->
  <!-- --------------------------------------------------------------------- -->
  <!-- GUARD -> Only visible for superusers -->
  <div v-if="isAdmin">
    <!-- ... -->
  </div>
</nav>
```