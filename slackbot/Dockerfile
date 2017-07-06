FROM node:8.1-alpine

WORKDIR /slackbot

ADD package.json ./
ADD package-lock.json ./
RUN npm install

ADD config.json ./
ADD src/ ./src/

CMD ["npm", "start"]
