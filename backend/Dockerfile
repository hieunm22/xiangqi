FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json yarn.lock prisma.config.ts ./
RUN yarn install --frozen-lockfile --production

COPY dist ./dist
COPY src/templates ./dist/templates
COPY src/generated ./dist/generated
COPY prisma ./prisma

EXPOSE 8000

CMD ["node", "dist/server.js"]
