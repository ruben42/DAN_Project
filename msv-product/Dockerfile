FROM node:20

WORKDIR /product-service

COPY package*.json ./

RUN npm install

COPY . . 

EXPOSE 3000

CMD ["node", "product-service.js"]