# Using Node.js base image version 21
FROM node:21

# Set the working directory
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the source code
COPY . .

# Expose the port
EXPOSE 3100

# Start the application
CMD ["npx", "prisma","generate"]
CMD ["npm", "start"]