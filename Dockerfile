FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN npx puppeteer browsers install chrome
COPY . .

# ประกาศ intent ว่า path พวกนี้จะถูก mount
VOLUME ["/app/jobs", "/app/users_id"]

CMD ["npm", "start"]
