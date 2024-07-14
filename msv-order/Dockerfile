FROM node:20

WORKDIR /order-service

COPY package*.json ./

RUN npm install

COPY . . 

EXPOSE 3001

CMD ["node", "order-service.js"]