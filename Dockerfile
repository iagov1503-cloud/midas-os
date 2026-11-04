FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_PATH=/data/midas.sqlite
COPY package.json *.js demo-records.json ./
COPY public ./public
COPY docs/chatgpt-instructions.md ./docs/chatgpt-instructions.md
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "server.js"]
