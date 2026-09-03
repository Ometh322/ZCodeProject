## План: Drag-n-drop редактор макета экрана зала (8px-сетка, pixel perfect)

### Концепция
Кнопка «Редактировать макет» в админке → открывает `/display?edit=1`. На экране зала включается режим редактирования: элементы (название, лого, блайнды, таймер) перетаскиваются мышью, примагничиваются к 8-пиксельной сетке, координаты округляются до целых. Панель редактора показывает числовые поля X/Y выбранного элемента (шаг 8) и боковой отступ. «Сохранить» пишет конфиг в БД; после этого обычный `/display` рендерит элементы по сохранённым абсолютным позициям. «Сбросить» возвращает дефолтный flex-layout.

### Модель данных
**Schema (`Tournament`):** `layoutConfig String?` — JSON-строка (паттерн как `logoImage`).

**Shared types:**
```ts
interface LayoutPos { x: number; y: number; }        // px, целые, кратно 8
interface LayoutConfig {
  name: LayoutPos; logo: LayoutPos; blinds: LayoutPos; timer: LayoutPos;
  marginX: number;   // боковой отступ центральной зоны (шаг 8)
}
```
- `TournamentState.layoutConfig: LayoutConfig | null`
- `UpsertTournamentInput.layoutConfig?: LayoutConfig | null`

**Repository:** `loadState` маппит `layoutConfig: t.layoutConfig ? JSON.parse(t.layoutConfig) : null`; новая функция `setLayoutConfig(cfg | null)` (зеркало `setLogoImage`).

**REST:** `PUT /api/tournament/layout` (body: LayoutConfig), `DELETE /api/tournament/layout` (сброс в null). Оба — admin + `engine.sync()`.

**Mиграция:** `prisma migrate dev --name layout_config`.

### Drag-n-drop редактор (только десктоп; мобайл остаётся статичным)

**Новый компонент `client/src/components/LayoutEditor.tsx`:**
- Оборачивает каждый из 4 элементов CenterColumn в `DraggableBox` — `position: absolute`, `left/top` из локального стейта
- **Pointer events** (`pointerdown/move/up` + `setPointerCapture`): при движении `x = Math.round(x / 8) * 8` (snap), округление до целых — pixel perfect
- **Визуальная сетка:** CSS `repeating-linear-gradient` каждые 8px (заметнее линии каждые 64px) на подложке контейнера
- **Выделение:** клик по элементу выбирает его (золотая рамка), поля панели синхронизированы двунаправленно с драгом
- **Панель инструментов** (fixed снизу): 4 строки с полями X/Y (input type=number, step=8, min=0), поле «Боковой отступ» (marginX, step 8), кнопки «💾 Сохранить», «↺ Сбросить», «✕ Выйти»
- **Инициализация позиций:** при входе в редактор, если `layoutConfig` есть — из него; если нет — `useLayoutEffect` замеряет `offsetLeft/offsetTop` текущих flex-элементов (стартовая точка = текущий вид), снапит к 8px
- Клонирует контент children (name/лого/блайнды/таймер рендерятся как обычно — со всеми адаптивными размерами шрифтов)

**Интеграция в DisplayPage:**
- Парсинг `?edit=1` из `useSearchParams`; режим редактирования доступен только при `isAdminDevice` (иначе — обычный просмотр)
- `containerRef` из `useDisplaySizes` остаётся на том же `<main>` — измерение ширины не ломается
- Обычный режим при наличии `layoutConfig`: те же 4 элемента в absolute-позициях (без панели и сетки); при `null` — текущий flex-layout (полная обратная совместимость)
- `marginX` применяется как горизонтальный padding центральной зоны

### Файлы
| Файл | Изменения |
|------|-----------|
| `server/prisma/schema.prisma` | `layoutConfig String?` |
| `shared/src/types.ts` | `LayoutPos`, `LayoutConfig`, поле в TournamentState/Input |
| `server/src/repository.ts` | loadState маппинг + `setLayoutConfig` |
| `server/src/rest.ts` | PUT/DELETE `/api/tournament/layout` |
| `client/src/api.ts` | `saveLayout`, `resetLayout` |
| `client/src/components/LayoutEditor.tsx` | Новый: DraggableBox, snap 8px, сетка, панель |
| `client/src/pages/DisplayPage.tsx` | Режим `?edit=1`, применение layoutConfig |
| `client/src/pages/AdminPage.tsx` | Кнопка «Редактировать макет экрана» |

### Проверка
Prisma migrate → typecheck (server+client) → vite build. Ручной сценарий: кнопка в админке → перетащить элементы → сохранить → открыть /display без параметров → позиции применены → сбросить → вернулся дефолт.