# Control Diario Centralizado de Caja

## Objetivo

Unificar en un solo flujo diario el dinero total administrado por el negocio, sin separar POS, corresponsal y transferencias.

El cuadre diario debe responder cuatro preguntas:

1. Cuanto dinero habia al iniciar el dia.
2. Que movimientos afectaron ese dinero durante el dia.
3. Cuanto deberia existir al cierre segun el sistema.
4. Cuanto existe realmente al cierre por cada medio.

## Problema actual

El sistema actual ya tiene una base util:

- `CashSession` guarda apertura y cierre de caja.
- `CashMovement` registra movimientos manuales de efectivo.
- `CorrespondentTransaction` registra operaciones por plataforma.
- `CorrespondentDailyClosure` resume cierres por corresponsal.
- `SalePayment` distingue pagos por `CASH`, `CARD` y `TRANSFER`.

Pero el modelo sigue fragmentado:

- `CashSession` esta centrado en efectivo POS.
- los saldos de corresponsal viven como datos auxiliares, no como cuentas formales;
- transferencias no existen como saldo diario contado;
- compras y gastos no salen de un medio especifico;
- el cuadre del corresponsal sigue compitiendo con el cuadre general.

## Principio contable y operativo

El cuadre general no debe organizarse por modulos, sino por medios de dinero.

Cada medio debe comportarse como una cuenta operativa:

- efectivo en caja;
- saldo de transferencias;
- saldo de cada corresponsal o plataforma.

Toda operacion del negocio debe impactar una o varias cuentas.

Ejemplos:

- venta en efectivo: `+ Caja`
- venta por transferencia: `+ Transferencias`
- compra pagada en efectivo: `- Caja`
- gasto pagado por transferencia: `- Transferencias`
- transaccion de corresponsal donde entra efectivo y baja PTM:
  - `+ Caja`
  - `- PTM`
  - `+ Comision` al medio donde quede esa comision
- traslado interno entre medios:
  - `- Caja`
  - `+ Transferencias`
  - no cambia el dinero total del negocio

## Diseno recomendado

### 1. Una sesion diaria unica

Mantener una sola sesion operativa por dia para todo el negocio.

Nombre recomendado:

- `BusinessDaySession`

### 2. Cuentas operativas de tesoreria

Cada medio de dinero debe ser una cuenta.

Ejemplos de registros:

- `CAJA_PRINCIPAL`
- `TRANSFERENCIAS_DISPONIBLES`
- `PTM`
- `PUNTORED`
- `BANCOLombia_CORRESPONSAL`
- `BANCO_BOGOTA_CORRESPONSAL`

### 3. Saldos por sesion y por cuenta

El sistema debe guardar apertura, esperado, contado y diferencia por cuenta en cada dia.

### 4. Entradas de tesoreria

Toda operacion debe producir movimientos atomicos sobre cuentas.

Una operacion puede generar una o varias entradas de tesoreria:

- entrada externa de dinero;
- salida externa de dinero;
- traslado interno entre medios;
- ajuste manual;
- conteo de cierre.

## Esquema Prisma propuesto

### Enums nuevos

```prisma
enum TreasuryAccountKind {
  CASH
  CORRESPONDENT
  TRANSFER
  BANK
  DIGITAL_WALLET
}

enum TreasuryAccountStatus {
  ACTIVE
  INACTIVE
}

enum BusinessDaySessionStatus {
  OPEN
  CLOSED
  CANCELLED
}

enum TreasuryEntryDirection {
  IN
  OUT
}

enum TreasuryEntryFlowType {
  EXTERNAL
  INTERNAL
}

enum TreasuryEntrySourceType {
  OPENING
  OPENING_ADJUSTMENT
  SALE
  SALE_PAYMENT
  SALE_RETURN
  CUSTOMER_PAYMENT
  PURCHASE
  EXPENSE
  CASH_MOVEMENT
  CORRESPONDENT_TRANSACTION
  INTERNAL_TRANSFER
  MANUAL_ADJUSTMENT
  CLOSING_COUNT
  CLOSING_ADJUSTMENT
}
```

### Modelos nuevos

```prisma
model TreasuryAccount {
  id                       String                @id @default(uuid())
  code                     String                @unique
  name                     String
  kind                     TreasuryAccountKind
  status                   TreasuryAccountStatus @default(ACTIVE)
  isPrimary                Boolean               @default(false)
  allowsManualCounting     Boolean               @default(true)
  allowsClosingControl     Boolean               @default(true)
  branchName               String?
  correspondentPlatformId  String?               @unique
  note                     String?
  createdAt                DateTime              @default(now())
  updatedAt                DateTime              @updatedAt

  correspondentPlatform CorrespondentPlatform? @relation(fields: [correspondentPlatformId], references: [id], onDelete: SetNull)
  balances              BusinessDayBalance[]
  entries               TreasuryEntry[]

  @@index([kind])
  @@index([status])
  @@index([isPrimary])
}

model BusinessDaySession {
  id                String                   @id @default(uuid())
  registerId        String?
  openedByUserId    String
  closedByUserId    String?
  previousSessionId String?
  businessDate      DateTime
  status            BusinessDaySessionStatus @default(OPEN)
  openingNote       String?
  closingNote       String?
  openedAt          DateTime                 @default(now())
  closedAt          DateTime?
  createdAt         DateTime                 @default(now())
  updatedAt         DateTime                 @updatedAt

  register         CashRegister?       @relation(fields: [registerId], references: [id], onDelete: SetNull)
  openedBy         User                @relation("BusinessDayOpenedBy", fields: [openedByUserId], references: [id], onDelete: Restrict)
  closedBy         User?               @relation("BusinessDayClosedBy", fields: [closedByUserId], references: [id], onDelete: SetNull)
  previousSession  BusinessDaySession? @relation("BusinessDayPrevious", fields: [previousSessionId], references: [id], onDelete: SetNull)
  nextSessions     BusinessDaySession[] @relation("BusinessDayPrevious")
  balances         BusinessDayBalance[]
  entries          TreasuryEntry[]

  @@unique([businessDate, status])
  @@index([businessDate])
  @@index([status])
  @@index([openedByUserId])
  @@index([closedByUserId])
}

model BusinessDayBalance {
  id                     String   @id @default(uuid())
  sessionId              String
  accountId              String
  previousClosingAmount  Int      @default(0)
  openingAmount          Int      @default(0)
  openingDifferenceAmount Int     @default(0)
  expectedAmount         Int      @default(0)
  countedAmount          Int?
  differenceAmount       Int      @default(0)
  openingNote            String?
  closingNote            String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  session BusinessDaySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  account TreasuryAccount    @relation(fields: [accountId], references: [id], onDelete: Restrict)

  @@unique([sessionId, accountId])
  @@index([accountId])
}

model TreasuryEntry {
  id               String                @id @default(uuid())
  sessionId        String
  accountId        String
  direction        TreasuryEntryDirection
  flowType         TreasuryEntryFlowType @default(EXTERNAL)
  sourceType       TreasuryEntrySourceType
  sourceId         String?
  groupKey         String?
  amount           Int
  affectsBusinessTotal Boolean           @default(true)
  note             String?
  performedAt      DateTime
  createdByUserId  String?
  createdAt        DateTime              @default(now())

  session   BusinessDaySession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  account   TreasuryAccount    @relation(fields: [accountId], references: [id], onDelete: Restrict)
  createdBy User?              @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)

  @@index([sessionId])
  @@index([accountId])
  @@index([sourceType])
  @@index([sourceId])
  @@index([groupKey])
  @@index([performedAt])
}
```

## Cambios recomendados a modelos existentes

### `User`

Agregar relaciones para apertura y cierre diario:

```prisma
  businessDaysOpened BusinessDaySession[] @relation("BusinessDayOpenedBy")
  businessDaysClosed BusinessDaySession[] @relation("BusinessDayClosedBy")
```

### `CashRegister`

Agregar relacion con la sesion diaria:

```prisma
  businessDaySessions BusinessDaySession[]
```

### `CorrespondentPlatform`

Agregar vinculo opcional a la cuenta de tesoreria correspondiente:

```prisma
  treasuryAccount TreasuryAccount?
```

### `SalePayment`

Hoy ya distingue `method`, pero falta decir a que cuenta llego realmente el dinero:

```prisma
model SalePayment {
  id               String        @id @default(uuid())
  saleId           String
  method           PaymentMethod
  treasuryAccountId String?
  amount           Int
  reference        String?
  createdAt        DateTime      @default(now())

  sale           Sale             @relation(fields: [saleId], references: [id], onDelete: Cascade)
  treasuryAccount TreasuryAccount? @relation(fields: [treasuryAccountId], references: [id], onDelete: SetNull)

  @@index([saleId])
  @@index([treasuryAccountId])
}
```

### `CustomerPayment`

El cobro de cartera tambien debe entrar por un medio definido:

```prisma
  treasuryAccountId String?
  treasuryAccount   TreasuryAccount? @relation(fields: [treasuryAccountId], references: [id], onDelete: SetNull)
```

### `Purchase`

Una compra debe registrar desde que medio se pago, incluso si luego se divide en varias cuotas. Para una primera fase, basta con un medio principal:

```prisma
  paymentAccountId String?
  paymentMethod    PaymentMethod?
  paymentAccount   TreasuryAccount? @relation(fields: [paymentAccountId], references: [id], onDelete: SetNull)

  @@index([paymentAccountId])
```

### `CashMovement`

Puede mantenerse como capa legacy temporal, pero a futuro debe quedar absorbido por `TreasuryEntry`.

### `CorrespondentTransactionType`

Hoy solo tiene `direction`. Eso no alcanza para cuadre general. El tipo debe definir como impacta cuentas:

```prisma
enum TreasuryImpactMode {
  EXTERNAL_IN
  EXTERNAL_OUT
  INTERNAL_TRANSFER
}

model CorrespondentTransactionType {
  id                        String                 @id @default(uuid())
  platformId                String
  code                      String
  name                      String
  direction                 CorrespondentDirection @default(NEUTRAL)
  treasuryImpactMode        TreasuryImpactMode     @default(INTERNAL_TRANSFER)
  cashAccountId             String?
  transferAccountId         String?
  commissionAccountId       String?
  isActive                  Boolean                @default(true)
  requiresCustomerDocument  Boolean                @default(false)
  requiresExternalReference Boolean                @default(false)
  allowsCommissionOverride  Boolean                @default(true)
  sortOrder                 Int                    @default(0)
  createdAt                 DateTime               @default(now())
  updatedAt                 DateTime               @updatedAt

  platform          CorrespondentPlatform         @relation(fields: [platformId], references: [id], onDelete: Cascade)
  cashAccount       TreasuryAccount?             @relation("CorrespondentTypeCashAccount", fields: [cashAccountId], references: [id], onDelete: SetNull)
  transferAccount   TreasuryAccount?             @relation("CorrespondentTypeTransferAccount", fields: [transferAccountId], references: [id], onDelete: SetNull)
  commissionAccount TreasuryAccount?             @relation("CorrespondentTypeCommissionAccount", fields: [commissionAccountId], references: [id], onDelete: SetNull)
  transactions      CorrespondentTransaction[]
  commissionRules   CorrespondentCommissionRule[]

  @@unique([platformId, code])
  @@index([platformId])
  @@index([isActive])
  @@index([cashAccountId])
  @@index([transferAccountId])
  @@index([commissionAccountId])
}
```

## Reglas operativas de generacion de `TreasuryEntry`

### Apertura

Por cada cuenta:

- se crea un `BusinessDayBalance`;
- `openingAmount` se toma del valor contado de apertura;
- `previousClosingAmount` se toma del cierre anterior;
- `openingDifferenceAmount = openingAmount - previousClosingAmount`.

Ademas, por trazabilidad, puede crearse una `TreasuryEntry` de tipo `OPENING`.

### Venta

- pago en `CASH`: `IN` a `CAJA_PRINCIPAL`
- pago en `TRANSFER`: `IN` a `TRANSFERENCIAS_DISPONIBLES`
- pago en `CARD`: puede mapearse temporalmente a `TRANSFERENCIAS_DISPONIBLES` si operativamente asi se administra

### Cobro de cartera

- `IN` a la cuenta seleccionada por el usuario

### Compra o gasto

- `OUT` desde la cuenta seleccionada

### Transaccion de corresponsal

Debe producir por lo menos dos entradas cuando el dinero cambia de medio.

Ejemplo: retiro desde PTM entregando efectivo:

- `OUT` en cuenta `PTM`
- `IN` en cuenta `CAJA_PRINCIPAL`

Si hay comision:

- `IN` adicional en la cuenta definida como receptora de comision

### Traslado interno

Un traslado entre medios debe crear dos entradas con el mismo `groupKey`:

- `OUT` cuenta origen
- `IN` cuenta destino

Y debe marcarse `flowType = INTERNAL`.

## Algoritmo de saldos

Por cada cuenta de la sesion:

```text
expectedAmount =
  openingAmount
  + sum(IN externos)
  - sum(OUT externos)
  + sum(IN internos)
  - sum(OUT internos)
```

La diferencia de cierre:

```text
differenceAmount = countedAmount - expectedAmount
```

La diferencia general del negocio:

```text
sum(differenceAmount de todas las cuentas)
```

## Flujo de apertura y cierre

### Apertura

1. El sistema toma el cierre contado del dia anterior por cuenta.
2. Propone esos valores como referencia.
3. El usuario registra el valor real con el que abre hoy.
4. Se muestran diferencias de apertura antes de confirmar.

### Cierre

1. El sistema calcula el esperado por cuenta.
2. El usuario cuenta efectivo, transferencias y cada corresponsal.
3. Se calcula diferencia por cuenta.
4. Se consolida diferencia total del negocio.
5. El cierre contado queda disponible como base del siguiente dia.

## Mapa de migracion recomendado

### Fase 1. Estructura sin romper lo actual

Crear:

- `TreasuryAccount`
- `BusinessDaySession`
- `BusinessDayBalance`
- `TreasuryEntry`

No eliminar aun:

- `CashSession`
- `CashMovement`
- `CorrespondentDailyClosure`

### Fase 2. Cuentas base y seed inicial

Crear cuentas operativas:

- una cuenta de efectivo principal;
- una cuenta de transferencias disponibles;
- una cuenta por cada `CorrespondentPlatform` activa.

### Fase 3. Backfill desde datos existentes

Backfill minimo:

- migrar `CashSession` a `BusinessDaySession`;
- crear `BusinessDayBalance` para efectivo usando:
  - `openingAmount` desde `CashSession.openingAmount`
  - `countedAmount` desde `CashSession.countedAmount`
  - `differenceAmount` desde `CashSession.differenceAmount`
- extraer `correspondentBalances` guardados en `note` y crear balances por plataforma;
- crear `TreasuryEntry` historicas basicas para:
  - apertura,
  - ventas,
  - movimientos de caja,
  - transacciones de corresponsal.

Backfill de transferencias:

- puede inferirse parcialmente desde `SalePayment.method = TRANSFER`
- si el historico no es confiable, arrancar transferencias como saldo formal desde la fecha de corte

### Fase 4. Dual write

Mientras conviven los modelos:

- abrir/cerrar caja debe escribir `CashSession` y `BusinessDaySession`;
- ventas deben escribir `SalePayment` y `TreasuryEntry`;
- compras y gastos deben empezar a registrar cuenta origen;
- corresponsal debe producir `TreasuryEntry`.

### Fase 5. Cutover funcional

Cambiar las lecturas de UI:

- `CashView` debe leer solo desde `BusinessDaySession`, `BusinessDayBalance` y `TreasuryEntry`;
- la vista de corresponsal debe quedar como resumen operativo, no como cuadre oficial.

### Fase 6. Deprecacion

Cuando el nuevo flujo este estable:

- deprecar `CorrespondentDailyClosure` como fuente principal de cuadre;
- mantener `CashSession` solo si sigue siendo necesaria por compatibilidad;
- mover `CashMovement` a un uso legacy o absorberla completamente.

## Orden de implementacion sugerido

1. Crear nuevos modelos y seed de cuentas.
2. Hacer que apertura y cierre diario usen `BusinessDaySession`.
3. Registrar transferencias como cuenta formal.
4. Hacer que ventas generen `TreasuryEntry`.
5. Hacer que compras y gastos exijan cuenta origen.
6. Hacer que corresponsal genere movimientos multi-cuenta.
7. Mover la UI de cuadre general al nuevo esquema.

## Decisiones importantes

### 1. No modelar transferencias solo como metodo de pago

Deben existir como saldo disponible del negocio.

### 2. No modelar corresponsal solo como `IN` y `OUT`

Cada tipo de corresponsal debe saber que cuenta debita, que cuenta acredita y donde deja la comision.

### 3. No usar `note` JSON como almacenamiento principal

Los saldos de apertura y cierre deben vivir en tablas propias, no en metadatos serializados.

### 4. El cuadre oficial debe ser unico

La vista de corresponsal puede seguir existiendo, pero el cierre operativo real debe vivir solo en el control diario general.

## Implementacion minima viable

Si se quiere avanzar sin reescribir todo de una vez, la minima secuencia segura es:

1. crear `TreasuryAccount`;
2. crear `BusinessDaySession` y `BusinessDayBalance`;
3. meter `TRANSFERENCIAS_DISPONIBLES` como nueva cuenta;
4. hacer que `CashView` use cuentas en vez de `note`;
5. despues migrar ventas, compras, gastos y corresponsal a `TreasuryEntry`.

## Resultado esperado

Con este diseno, el sistema podra responder siempre:

- cuanto habia al iniciar por medio;
- que paso durante el dia;
- cuanto deberia haber por medio;
- cuanto hubo realmente por medio;
- donde esta la diferencia;
- si la apertura del siguiente dia coincide con el cierre anterior.
