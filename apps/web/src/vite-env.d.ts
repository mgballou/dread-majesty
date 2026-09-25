/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the backstage publishes the chain. Unset, the game runs on the bundled one. */
  readonly VITE_CHAIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
