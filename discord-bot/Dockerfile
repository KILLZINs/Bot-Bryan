FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema necessárias para Prisma
RUN apk add --no-cache openssl

# Copiar manifests de dependências
COPY package.json ./

# Instalar dependências
RUN npm install

# Copiar o restante do código
COPY . .

# Gerar Prisma client e compilar TypeScript
RUN npx prisma generate && npm run build

# Iniciar o bot
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/deploy-commands.js && node dist/index.js"]
