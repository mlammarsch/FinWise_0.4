# ApexCharts-DaisyUI-Integration

## Übersicht

Diese Dokumentation beschreibt die vollständige Integration von ApexCharts mit DaisyUI in der FinWise-Anwendung, einschließlich horizontaler Legende-Optimierung und konsistenter Theme-Integration.

## Implementierte Features

### 1. Horizontale Legende-Optimierung

Die Legende wurde für vollständig horizontale Darstellung optimiert:

```typescript
legend: {
  show: true,
  position: isSmallScreen.value ? "bottom" : "top",
  horizontalAlign: "center",
  floating: false,
  fontSize: isSmallScreen.value ? "11px" : "12px",
  fontFamily: themeColors.fontFamily,
  fontWeight: 400,
  itemMargin: {
    horizontal: isSmallScreen.value ? 12 : 20, // Responsive Abstände
    vertical: isSmallScreen.value ? 6 : 8,
  },
  offsetY: isSmallScreen.value ? 5 : 0,
  offsetX: 0,
  labels: {
    colors: themeColors.baseContent,
    useSeriesColors: false
  },
  markers: {
    width: isSmallScreen.value ? 10 : 12,
    height: isSmallScreen.value ? 10 : 12,
    radius: 2,
    offsetX: 0,
    offsetY: 0,
    strokeWidth: 0,
    strokeColor: "transparent",
    fillColors: undefined, // Verwendet automatisch die Series-Farben
  },
  onItemClick: {
    toggleDataSeries: true
  },
  onItemHover: {
    highlightDataSeries: true
  }
}
```

**Wichtige Konfigurationen:**
- `floating: false` - Verhindert überlappende Legende
- `itemMargin.horizontal: 20` - Ausreichend Abstand zwischen Items
- `position: "top"` - Optimale Position für horizontale Darstellung
- Responsive Anpassungen für mobile Geräte

### 2. DaisyUI Theme-Integration

#### CSS-Variablen-Zugriff

```typescript
const getCSSVariableValue = (variableName: string): string => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  // Fallback falls Variable nicht gefunden wird
  if (!value) {
    console.warn(`CSS Variable ${variableName} not found`);
    return "#000000";
  }

  // OKLCH-Format-Unterstützung
  if (value.includes("%") && value.includes(" ")) {
    return `oklch(${value})`;
  }

  return value;
};
```

#### Schriftfamilien-Integration

```typescript
const getFontFamily = (): string => {
  const htmlElement = document.documentElement;
  const computedStyle = getComputedStyle(htmlElement);
  const fontFamily = computedStyle.fontFamily;

  // Fallback auf die in style.css definierte Schriftfamilie
  return fontFamily || "Inter, 'Source Sans Pro', Roboto, system-ui, sans-serif";
};
```

#### Theme-Farben-Mapping

```typescript
const getThemeColors = () => {
  return {
    success: getCSSVariableValue("--color-success"),
    error: getCSSVariableValue("--color-error"),
    warning: getCSSVariableValue("--color-warning"),
    baseContent: getCSSVariableValue("--color-base-content"),
    textColor: getCSSVariableValue("--color-base-content"),
    primary: getCSSVariableValue("--color-primary"),
    secondary: getCSSVariableValue("--color-secondary"),
    accent: getCSSVariableValue("--color-accent"),
    base100: getCSSVariableValue("--color-base-100"),
    base200: getCSSVariableValue("--color-base-200"),
    base300: getCSSVariableValue("--color-base-300"),
    neutral: getCSSVariableValue("--color-neutral"),
    info: getCSSVariableValue("--color-info"),
    fontFamily: getFontFamily(),
  };
};
```

### 3. Responsive Verhalten

#### Screen-Size-Detection

```typescript
const isSmallScreen = ref(false);

const updateScreenSize = () => {
  isSmallScreen.value = window.innerWidth < 640; // Tailwind sm breakpoint
};
```

#### Responsive Konfiguration

- **Desktop (≥640px):**
  - Legende oben positioniert
  - Größere Schriftart (12px)
  - Mehr Abstand zwischen Items (20px)
  - Größere Marker (12x12px)

- **Mobile (<640px):**
  - Legende unten positioniert
  - Kleinere Schriftart (11px)
  - Weniger Abstand zwischen Items (12px)
  - Kleinere Marker (10x10px)

### 4. Chart-Styling-Integration

#### Globale Chart-Konfiguration

```typescript
chart: {
  height: 350,
  type: "line",
  stacked: false,
  background: "transparent",
  foreColor: themeColors.textColor,
  fontFamily: themeColors.fontFamily, // Globale Schriftfamilie
  toolbar: {
    show: false,
  },
  animations: {
    enabled: true,
    easing: "easeinout",
    speed: 800,
  },
}
```

#### Achsen-Styling

```typescript
xaxis: {
  labels: {
    style: {
      colors: Array(data.labels.length).fill(themeColors.textColor),
      fontSize: "12px",
      fontFamily: themeColors.fontFamily,
    },
  },
  title: {
    style: {
      color: themeColors.baseContent,
      fontSize: "12px",
      fontFamily: themeColors.fontFamily,
    },
  },
}
```

### 5. Theme-Watcher-System

#### MutationObserver für Theme-Änderungen

```typescript
const setupThemeObserver = () => {
  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "data-theme"
      ) {
        const newTheme = document.documentElement.getAttribute("data-theme");
        if (newTheme !== themeWatcher.value) {
          themeWatcher.value = newTheme;
          setTimeout(() => {
            updateChart();
          }, 50);
        }
      }
    });
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
};
```

#### Pinia Store Integration

```typescript
watch(
  () => themeStore.isDarkMode,
  () => {
    setTimeout(() => {
      updateChart();
    }, 50);
  }
);
```

## Verwendete DaisyUI-Variablen

### Light Theme
```css
--color-primary: #856ac1;
--color-secondary: #a49db4;
--color-accent: #9d54bb;
--color-neutral: #a39fa8;
--color-base-100: #f0edf2;
--color-base-200: #e2e0e3;
--color-base-300: #cdc9cf;
--color-base-content: #141414;
--color-info: #1cadca;
--color-success: #529455;
--color-warning: #f1c40f;
--color-error: #cf5151;
```

### Dark Theme
```css
--color-primary: #856ac1;
--color-secondary: #a49db4;
--color-accent: #9d54bb;
--color-neutral: #a8a7a9;
--color-base-100: #1a161d;
--color-base-200: #211f25;
--color-base-300: #38353b;
--color-base-content: #bdbcbd;
--color-info: #1cadca;
--color-success: #76b279;
--color-warning: #f1c40f;
--color-error: #ff0000;
```

## Schriftfamilien-Integration

### CSS-Definition (style.css)
```css
@layer base {
  html {
    font-family: 'Inter', '"Source Sans Pro"', 'Roboto', system-ui, sans-serif;
  }
}
```

### ApexCharts-Integration
- Globale Chart-Schriftfamilie über `chart.fontFamily`
- Spezifische Schriftfamilien für Achsen-Labels und -Titel
- Legende-Schriftfamilie aus CSS-Variablen
- Fallback-Mechanismus bei fehlenden Schriftarten

## Performance-Optimierungen

### Debounced Updates
- 50ms Verzögerung bei Theme-Änderungen
- Verhindert excessive Chart-Updates

### Event-Listener-Management
```typescript
onMounted(() => {
  updateScreenSize();
  window.addEventListener('resize', updateScreenSize);
  createChart();
  setupThemeObserver();
});

onUnmounted(() => {
  if (chart) {
    chart.destroy();
    chart = null;
  }
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
  window.removeEventListener('resize', updateScreenSize);
});
```

### Watchers
```typescript
// Chart-Daten-Updates
watch(chartData, () => {
  updateChart();
}, { deep: true });

// Theme-Updates
watch(() => themeStore.isDarkMode, () => {
  setTimeout(() => {
    updateChart();
  }, 50);
});

// Responsive Updates
watch(isSmallScreen, () => {
  updateChart();
});
```

## Troubleshooting

### Häufige Probleme

1. **Legende nicht horizontal:**
   - Prüfe `floating: false`
   - Stelle sicher, dass `itemMargin.horizontal` ausreichend groß ist
   - Verwende `position: "top"` oder `"bottom"`

2. **Schriftarten nicht konsistent:**
   - Prüfe `getFontFamily()` Funktion
   - Stelle sicher, dass `fontFamily` in allen Style-Objekten gesetzt ist
   - Verwende globale `chart.fontFamily` Konfiguration

3. **Theme-Farben nicht aktualisiert:**
   - Prüfe MutationObserver-Setup
   - Stelle sicher, dass `updateChart()` nach Theme-Änderungen aufgerufen wird
   - Verwende korrekte CSS-Variablennamen

4. **Responsive Verhalten funktioniert nicht:**
   - Prüfe `updateScreenSize()` Event-Listener
   - Stelle sicher, dass `isSmallScreen` Watcher aktiv ist
   - Verwende korrekte Breakpoint-Werte

### Debug-Tipps

```typescript
// CSS-Variablen-Werte prüfen
console.log('Theme Colors:', getThemeColors());

// Screen-Size-Status prüfen
console.log('Is Small Screen:', isSmallScreen.value);

// Chart-Optionen prüfen
console.log('Chart Options:', chartOptions.value);
```

## Best Practices

1. **Konsistente Farbverwendung:**
   - Verwende immer DaisyUI-Variablen
   - Implementiere Fallback-Farben
   - Teste beide Themes (Light/Dark)

2. **Responsive Design:**
   - Teste auf verschiedenen Bildschirmgrößen
   - Verwende sinnvolle Breakpoints
   - Optimiere Legende-Position für mobile Geräte

3. **Performance:**
   - Verwende debounced Updates
   - Cleanup Event-Listener ordnungsgemäß
   - Vermeide excessive Chart-Redraws

4. **Accessibility:**
   - Verwende ausreichende Farbkontraste
   - Implementiere Keyboard-Navigation
   - Teste mit Screen-Readern

## Erweiterungsmöglichkeiten

### Custom Legend
Falls die Standard-Legende nicht ausreicht:

```vue
<template>
  <div class="card bg-base-100 shadow-md">
    <div class="card-body">
      <div class="flex justify-between items-center mb-4">
        <h3 class="card-title text-lg">Finanztrend (6 Monate)</h3>
        <!-- Custom Legend -->
        <div class="flex items-center gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-sm bg-success"></div>
            <span>Einnahmen</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-sm bg-error"></div>
            <span>Ausgaben</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-1 bg-warning"></div>
            <span>Kontosaldo</span>
          </div>
        </div>
      </div>
      <div ref="chartContainer" class="w-full"></div>
    </div>
  </div>
</template>
```

### Erweiterte Theme-Integration
```typescript
// Zusätzliche Theme-Variablen
const getExtendedThemeColors = () => {
  return {
    ...getThemeColors(),
    // Erweiterte Farben
    primaryContent: getCSSVariableValue("--color-primary-content"),
    secondaryContent: getCSSVariableValue("--color-secondary-content"),
    accentContent: getCSSVariableValue("--color-accent-content"),
    // Gradient-Unterstützung
    gradientFrom: getCSSVariableValue("--color-primary"),
    gradientTo: getCSSVariableValue("--color-secondary"),
  };
};
```

## Fazit

Die ApexCharts-DaisyUI-Integration bietet:
- ✅ Vollständig horizontale Legende
- ✅ Konsistente Theme-Integration
- ✅ Responsive Verhalten
- ✅ Schriftfamilien aus style.css
- ✅ Automatische Theme-Updates
- ✅ Performance-Optimierungen

Die Implementierung ist robust, wartbar und erweiterbar für zukünftige Chart-Komponenten in der FinWise-Anwendung.
