FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose Vite dev port
EXPOSE 5173

# Start in dev mode for development experience
CMD ["npm", "run", "dev", "--", "--host"]
