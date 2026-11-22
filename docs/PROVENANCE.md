# Provenance, derivation and distribution

The grammar source in `grammar/grammar.js` is derived from Ben Siraphob's
`tree-sitter-promela` repository, initially based on upstream commit
`91da8f141c3c4c695eb71018c8a7b2e7ea39c167` (11 February 2022).
The upstream grammar is MIT licensed; its original copyright and permission
notice are preserved in `grammar/LICENSE` and staged at
`THIRD_PARTY_LICENSES/siraben-tree-sitter-promela-MIT.txt`.

The project also depends on Tree-sitter and `web-tree-sitter` (MIT); runtime
license notices are staged into `THIRD_PARTY_LICENSES`.
The grammar's generated `.wasm` is distributable as a derived artifact, not an
independent invention. The SHA-256 build fingerprint is an internal stale-build
check, not a cryptographic supply-chain attestation or reproducibility proof.

The root `LICENSE` currently has a generic contributor attribution. Before
public publication, replace or supplement it with the accurate copyright
holders for original project contributions. Do not remove the upstream license.
SPIN is not bundled. Bundling it later requires separate license review.

No GitHub URL, publisher identity, npm publication history or external
ownership is claimed for this project yet.
