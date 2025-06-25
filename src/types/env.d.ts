/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_PORT: string;
  // andere Umgebungsvariablen hier definieren
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
