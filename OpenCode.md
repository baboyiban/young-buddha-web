# OpenCode Guidelines

## Build, Lint, and Test Commands
### Backend
- **Build**: `zig build`
- **Run server**: `backend/run.sh`
- **Test**: Zig does not seem to have tests defined. Check documentation or scripts folder.

### Frontend
- **Install dependencies**: `bun install`
- **Run locally**: `bun run dev`
- **Build**: `bun run build`
- **Lint**: `bun run lint` (default linter)
- **Test**: `bun run test` (use `bun test <file>` for individual tests)

## Code Style Guidelines
### Backend
- **Imports**: Use Zig's `@import` for modules; keep them alphabetical.
- **Formatting**: Zig's default formatter.
- **Naming**: Snake_case for variables and functions; PascalCase for types.
- **Error handling**: Use `catch` or standard Zig error unions and enums for errors.
- **Types**: Prefer explicit typing; avoid dynamic types where possible.

### Frontend
- **Imports**: Group by type (libraries, utilities, components, local files).
- **Formatting**: Follow `.prettierrc` rules if applicable.
- **Naming**: camelCase for variables and functions; PascalCase for components and types.
- **Error handling**: Use custom error utilities (like `lib/error/handlers.ts`). Avoid `console.log` in production.
- **Types**: Use TypeScript extensively with strict typings (avoid `any`). Prefer interfaces over types for structured objects.