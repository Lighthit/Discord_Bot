FROM node:24-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-thai-tlwg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# ติดตั้ง uv/uvx สำหรับรัน MCP web-search server (duckduckgo-mcp-server)
ENV UV_INSTALL_DIR=/usr/local/bin
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/usr/local/bin:${PATH}"

# ดึง duckduckgo-mcp-server ลงมาแคชไว้ล่วงหน้า จะได้ไม่ต้องดาวน์โหลดตอน container สตาร์ทครั้งแรก
RUN uvx --from duckduckgo-mcp-server duckduckgo-mcp-server --help || true

COPY package*.json ./
RUN npm install

COPY . .
VOLUME ["/app/jobs", "/app/users_id"]
CMD ["npm", "start"]