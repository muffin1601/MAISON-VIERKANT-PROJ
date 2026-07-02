// Ambient declarations for side-effect style imports so both the Next.js build
// typechecker and the editor's TS server resolve `import "./x.css"` / ".scss".
declare module "*.css";
declare module "*.scss";
