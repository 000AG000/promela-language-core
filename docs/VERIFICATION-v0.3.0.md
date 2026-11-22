# v0.3.0 verification status

The 0.2.4 source base is verified by the user's real WASM build and parser
output. The v0.3.0 additions in this artifact have not been tested by a real
Tree-sitter generator or VS Code extension host in the preparation environment.

Run `npm test` on a clean install. This must regenerate grammar, build WASM and
run all 17 tests; any failure blocks release staging. `npm run release:core`
then stages the distributable, and `npm pack --dry-run`/`vsce ls` checks the
published VSIX contents.

Caveats:
- This project now accepts single-line `#` directives as extra nodes, but
  does **not** evaluate them, resolve `#include` or expand multiline macros.
- `unsigned` declarations get a distinct grammar node and symbol resolution.
- `c_code`, `c_expr`, `c_decl`, `c_state`, `c_track` are still unsupported.
- VS Code integration template is illustrative and needs extension-host tests.
