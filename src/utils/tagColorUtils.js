/**
 * Utility-Funktionen für Tag-Farben
 */
// Verfügbare Tag-Farben basierend auf den CSS-Variablen in style.css
const TAG_COLORS = [
    'primary',
    'secondary',
    'accent',
    'info',
    'success',
    'warning',
    'error',
    'neutral'
];
/**
 * Gibt eine zufällige Tag-Farbe aus den verfügbaren Farben zurück
 */
export function getRandomTagColor() {
    const randomIndex = Math.floor(Math.random() * TAG_COLORS.length);
    return TAG_COLORS[randomIndex];
}
/**
 * Gibt alle verfügbaren Tag-Farben zurück
 */
export function getAvailableTagColors() {
    return [...TAG_COLORS];
}
