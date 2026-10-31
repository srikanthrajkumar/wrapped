// Record and sync types, shared by the app, the Supabase tests and the tools.
// Files in this folder import nothing from screens, the store or UI libraries
// (eng review D1); eslint.config.js enforces it.
export * from './detail-value';
export * from './ids';
export * from './records';
export * from './sync-payloads';
