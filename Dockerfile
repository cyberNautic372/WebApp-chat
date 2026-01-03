FROM node:20
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 7736
CMD ["npm","start"]
