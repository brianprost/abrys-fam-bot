# from node 18.x
FROM node:18

COPY package.json ./
RUN npm install

COPY index.ts tsconfig.json .env ./

CMD [ "npm", "start" ]