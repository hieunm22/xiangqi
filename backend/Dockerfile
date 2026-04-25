FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

COPY prisma ./prisma
RUN npx prisma generate

COPY dist ./dist

EXPOSE 8000

CMD ["node", "dist/server.js"]
