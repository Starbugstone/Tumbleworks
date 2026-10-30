FROM node:24-bookworm-slim
WORKDIR /app
RUN mkdir -p node_modules && chown -R node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
EXPOSE 5180
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run dev"]
