FROM node:24-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    unzip \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install

RUN npx puppeteer browsers install chrome

COPY . .

VOLUME ["/app/jobs", "/app/users_id"]

CMD ["npm", "start"]
