# Use a Node.js base image
FROM node:18-alpine

# Install curl
RUN apk add --no-cache curl

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (including devDependencies)
RUN npm install

# Copy the rest of the application code
COPY ./producer.js .
COPY ./loadTestWorker.js .
COPY ./artillery-config.json .

# Expose the port your app will listen on
EXPOSE 3001

# Set the default command to run the app in development mode
CMD ["npm", "run", "producer_dev"]
