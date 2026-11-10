FROM node:20-alpine
WORKDIR /app
COPY package.json index.js ./
COPY data ./data
RUN mkdir -p data
EXPOSE 3000
CMD ["node", "index.js"]
