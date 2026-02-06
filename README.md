<div align="center">
  <br />
  <br />

  # <code>padel-counters</code>

  **MOTOR DE COMENTARIOS DEPORTIVOS EN TIEMPO REAL**
  <br />

  [![Bun](https://img.shields.io/badge/bun-v1.2.16-black?style=for-the-badge&logo=bun)](https://bun.sh)
  [![Hono](https://img.shields.io/badge/hono-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev/)
  [![TypeScript](https://img.shields.io/badge/typescript-%23007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Drizzle](https://img.shields.io/badge/drizzle-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
  [![Neon](https://img.shields.io/badge/neon-00E599?style=for-the-badge&logo=neon&logoColor=black)](https://neon.tech/)


  <br />
  <br />
</div>

---

### 00 __ VISTA PREVIA

> **ABSTRACT:** Sistema de backend de alto rendimiento para la gestión y transmisión de eventos deportivos en tiempo real. Orquestación nativa de WebSockets sobre Bun con validación estricta y limitación de velocidad serverless.
>
> <br />
>
> **ESTADO:** ⚠️ EN DESARROLLO PERO FUNCIONAL.
>
> <br />
>
>
> **ORIGIN:** Based on the [WebSockets Crash Course](https://www.youtube.com/watch?v=pbOXOY78dNA) by [JavaScript Mastery](https://www.youtube.com/@javascriptmastery).
> *Adapted to Bun + Hono ecosystem by user with extensive educational comments.*
> <br />
> <br />

---

### 01 __ ARQUITECTURA Y DECISIONES

| COMPONENTE | TECNOLOGÍA | NOTA |
| :--- | :--- | :--- |
| **Runtime** | `Bun` | Ejecución JS/TS nativa de baja latencia |
| **Router** | `Hono` | Estándares Web, middleware ligero y tipado |
| **Real-time** | `Bun WebSocket` | Implementación C++ optimizada (sin `ws` lib) |
| **Database** | `Neon (Postgres)` | Serverless SQL para escalabilidad automática |
| **ORM** | `Drizzle` | Introspección de esquema y consultas type-safe |
| **Protection** | `Upstash Redis` | Rate Limiting distribuido (Sliding Window) |

<br>

### 02 __ INSTALACIÓN

*Iniciar entorno de desarrollo:*

```bash
# 1. Clonar repositorio
git clone https://github.com/samuhlo-training/padel-counters.git

# 2. Instalar dependencias
bun install

# 3. Sincronizar Base de Datos (Requiere .env)
bun run db:generate
bun run db:migrate

# 4. Iniciar Servidor
bun run dev
```

### 03 __ CARACTERÍSTICAS CLAVE

*   **Zero-Overhead WebSockets**: Uso directo de `Bun.upgrade` integrado en Hono.
*   **Resilient Rate Limiting**: Middleware con estrategia "Fail-open" (si Redis cae, el tráfico pasa).
*   **Domain-Driven Structure**: Organización por módulos (`routes/matches`, `ws/server`) en lugar de capas técnicas puras.
*   **Strict Typing**: Schema validation con Zod + TypeScript en cada frontera (HTTP & DB).

A. THE HOOK (RESILIENT MIDDLEWARE)
Intercepta conexiones WS, valida IP contra Redis Cloud y aplica lógica de fallback si el servicio externo falla.

```typescript
// [BRUTALIST SNIPPET] :: src/index.ts
app.use("/ws", async (c, next) => {
  // A. IDENTIFICAR -> IP Fallback logic
  let ip = c.req.header("CF-Connecting-IP") || c.req.header("x-forwarded-for")?.split(",")[0]?.trim();

  // B. VERIFICAR -> Pedir permiso a Redis (Fail-open Pattern)
  let limitResult;
  try {
    limitResult = await ratelimit.limit(ip || "127.0.0.1");
  } catch (error) {
    // [RESILIENCE] -> Si Redis falla, no bloqueamos el servicio
    limitResult = { success: true, remaining: Infinity };
  }

  if (!limitResult.success) {
    return c.text("ERROR: Rate limit exceeded. Relax.", 429);
  }

  await next();
});
```

<div align="center">
<br />

<code>DISEÑADO Y CODIFICADO POR <a href='https://github.com/samuhlo'>samuhlo</a></code>

<small>Lugo, Galicia</small>

</div>
