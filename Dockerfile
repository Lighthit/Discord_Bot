FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# ประกาศ intent ว่า path พวกนี้จะถูก mount
VOLUME ["/app/jobs", "/app/users_id"]

CMD ["npm", "start"]