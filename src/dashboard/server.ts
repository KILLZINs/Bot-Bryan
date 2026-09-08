stage-0
FROM ghcr.io/railwayapp/nixpacks:ubuntu-1745885067@sha256:d45c89d80e13d7ad0fd555b5130f22a866d9dd10e861f589932303ef2314c7de
73ms
scheduling build on Metal builder "builder-djsmlz"
unpacking archive
19.3 MB
114ms
using build driver nixpacks-v1.41.0

local://prepare-driver
0ms

local://prepare-context
0ms
uploading snapshot
16.4 MB
318ms

railway
prepare nixpacks-v1.41.0
754ms

╔══════════════════════════════ Nixpacks v1.41.0 ══════════════════════════════╗
║ setup      │ ffmpeg, nodejs_20, npm-9_x, openssl                             ║
║──────────────────────────────────────────────────────────────────────────────║
║ install    │ npm i                                                           ║
║──────────────────────────────────────────────────────────────────────────────║
║ build      │ npm run build                                                   ║
║──────────────────────────────────────────────────────────────────────────────║
║ start      │ npx prisma db push --accept-data-loss && node dist/deploy-      ║
║            │ commands.js && npm run start                                    ║
╚══════════════════════════════════════════════════════════════════════════════╝


Saved output to:
  /out

internal
load build definition from Dockerfile
0ms

internal
load metadata for ghcr.io/railwayapp/nixpacks:ubuntu-1745885067
254ms

internal
load .dockerignore
0ms
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ARG "CLIENT_SECRET") (line 11)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ARG "DISCORD_TOKEN") (line 11)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ARG "ELEVENLABS_API_KEY") (line 11)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ARG "GEMINI_API_KEY") (line 11)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ARG "MISTRAL_API_KEY") (line 11)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ARG "OPENAI_API_KEY") (line 11)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ENV "CLIENT_SECRET") (line 12)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ENV "DISCORD_TOKEN") (line 12)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ENV "ELEVENLABS_API_KEY") (line 12)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ENV "GEMINI_API_KEY") (line 12)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ENV "MISTRAL_API_KEY") (line 12)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data (ENV "OPENAI_API_KEY") (line 12)(https://docs.docker.com/go/dockerfile/rule/secrets-used-in-arg-or-env/)
 details: Sensitive data should not be used in the ARG or ENV commands
UndefinedVar: Usage of undefined variable '$NIXPACKS_PATH' (line 18)(https://docs.docker.com/go/dockerfile/rule/undefined-var/)
 details: Variables should be defined before their use

internal
load build context
0ms

stage-0
RUN nix-env -if .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix && nix-collect-garbage -d cached
1ms

stage-0
COPY .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix .nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix cached
0ms

stage-0
WORKDIR /app/ cached
0ms

stage-0
COPY . /app/.
904ms

stage-0
RUN npm i
26s
Run `npm audit` for details.

stage-0
COPY . /app/.
656ms

stage-0
RUN npm run build
7s
npm warn config production Use `--omit=dev` instead.
> alianca-skyline-bot@2.1.0 build
> rm -rf dist && tsc
src/dashboard/server.ts(713,48): error TS2304: Cannot find name 'GLOBAL_CATEGORIES'.

src/dashboard/server.ts(714,46): error TS2304: Cannot find name 'SERVER_SETTINGS'.

Build Failed: build daemon returned an error < failed to solve: process "/bin/bash -ol pipefail -c npm run build" did not complete successfully: exit code: 2
