FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

COPY package*.json ./
COPY e2e/ ./e2e/

RUN npm ci --only=dev

WORKDIR /app/e2e

CMD ["npx", "playwright", "test"]
