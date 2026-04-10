## Shopify Countdown Timer

This is a custom Shopify application built for Helixo, designed to create high-conversion urgency on product pages. It utilizes a MERN stack architecture (MongoDB, Express, React, Node) within the React Router (formerly Remix) framework for Shopify.

## 🚀 Key Features
Fixed Timers: Set a global end date and time for sales or events.

Evergreen Timers: Create a per-visitor countdown that starts when they first land on the page.

Smart Targeting: Choose to show timers on all products or specific selected items via the Resource Picker.

Dynamic UI: Control position (TOP/BOTTOM), size (SMALL to LARGE), and urgency animations (Shake/Pulse) directly from the manager.

App Proxy Integration: High-performance, secure storefront data fetching that bypasses theme liquid limitations.

## 🛠️ Tech Stack
Framework: React Router (Shopify App Template)

Database: MongoDB Atlas via Mongoose

Session Storage: MongoDBSessionStorage from @shopify/shopify-app-session-storage-mongodb

Storefront: Shopify Theme App Extensions (Liquid + Vanilla JS)

## 📋 Quick Start
1. Prerequisites
Shopify CLI installed

A MongoDB Atlas Cluster (IP Whitelisted for 0.0.0.0/0 or your dev IP)

2. Setup Environment
Create a .env file in the root directory:

Shell
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/your_db
SCOPES=write_products,write_metafields
APP_URL=https://your-ngrok-url.ngrok-free.app
3. Local Development
Shell
# Install dependencies
npm install

# Start the development server
shopify app dev

## 🏗️ Architecture Note: MongoDB over Prisma
Unlike the standard Shopify template which uses Prisma/SQLite, this project uses Mongoose to handle document-based storage for flexible timer configurations.

Schema: Defined in /app/models/Timer.server.js.

Connection: Handled via /app/db.server.js to ensure a singleton connection across React Router hot-reloads.

## 🔗 API Proxy Logic
To display timers on the storefront without hitting Shopify Admin API limits, we use an App Proxy.

Internal Endpoint: /app/routes/api.proxy.jsx

Storefront URL: /apps/timer-logic/api/proxy

The Liquid extension fetches from this proxy, allowing us to serve dynamic MongoDB data directly to the customer's browser securely.

## ⚠️ Watch out for these 

MongoDB SSL Handshake Errors
If you see SSL alert number 80, check your MongoDB Atlas Network Access settings. Your current development IP address must be whitelisted.

Schema Updates
If you add a field to the Timer model, you must update the Schema in Timer.server.js and restart the server. Mongoose will ignore fields in the payload that aren't defined in the Schema.

## 📦 Deployment
This app is optimized for deployment on Google Cloud Run or Render.

Ensure NODE_ENV=production is set.

Set your SHOPIFY_API_KEY and MONGODB_URI in your hosting provider's "Secrets" or "Environment Variables" section.

Deploy the Theme App Extension using shopify app deploy.